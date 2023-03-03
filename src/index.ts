//@ts-nocheck
import { Client, GatewayIntentBits, Message, TextChannel, Interaction, GuildMember, ChannelType, Events } from 'discord.js';
import { VoiceConnection, VoiceConnectionStatus, joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, DiscordGatewayAdapterCreator, entersState } from '@discordjs/voice';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
dotenv.config();
import cron from 'cron';
import moment from 'moment-timezone';
import regexToText from './regex-to-text';
import regexToAudio from './regex-to-audio';
import regexToReact from './regex-to-react';
import { getEmotes } from './emotes';

// @ts-ignore
import Transcriber from 'discord-speech-to-text';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates] });
let mainChannel: TextChannel | undefined;
let voiceLogChannel: TextChannel | undefined;

const player = createAudioPlayer();
let timeoutId: NodeJS.Timer | null = null;
let connection: VoiceConnection;
const transcriber = new Transcriber(process.env.WITAI_KEY);

// Disconnect after 15 min of inactivity
// Reset timeout when audio playing
player.on(AudioPlayerStatus.Playing, (): void => {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
});
// Start timeout timer when idle
player.on(AudioPlayerStatus.Idle, (): void => {
    player.stop();
    timeoutId = setTimeout(() => {
        connection.destroy();
        timeoutId = null;
    }, 900000);
});

interface voiceConnection {
    channelId: string,
    guildId: string,
    adapterCreator: DiscordGatewayAdapterCreator
}

//Create voice connection
function joinVoice(voiceConnection: voiceConnection) {
    connection = joinVoiceChannel(voiceConnection);
    // Add event listener on receiving voice input
    if (connection.receiver.speaking.listenerCount('start') === 0) {
        connection.receiver.speaking.on('start', async (userId) => {
            // Return if audio player is playing audio
            if (player.state.status === AudioPlayerStatus.Playing) return;
            // Return if speaker is a bot
            if (client.users.cache.get(userId)?.bot) return;
            transcriber.listen(connection.receiver, userId, client.users.cache.get(userId)).then((data: any) => {
                if (!data.transcript.text || player.state.status === AudioPlayerStatus.Playing) return;
                const text = data.transcript.text.toLowerCase();
                const username = client.users.cache.get(userId)?.username;
                const voiceTextLog = `[${new Date().toLocaleTimeString('en-US')}] ${username}: ${text}`
                console.log(voiceTextLog);
                if (voiceLogChannel && voiceLogChannel.type === ChannelType.GuildText) {
                    voiceLogChannel.send(voiceTextLog).catch((e) => console.log(`Error sending to voiceLogChannel: ${e}`));
                }
                for (let regexAudio of regexToAudio) {
                    const audio = regexAudio.getAudio();
                    if (regexAudio.regex.test(text) && audio) {
                        playAudioFile(audio, username);
                        break;
                    }
                }
            });
        });
    }
    // Remove listeners on disconnect
    if (connection.listenerCount(VoiceConnectionStatus.Disconnected) === 0) {
        connection.on(VoiceConnectionStatus.Disconnected, async () => {
            connection.receiver.speaking.removeAllListeners();
            try {
                await Promise.race([
                    entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                    entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                ]);
                // Seems to be reconnecting to a new channel - ignore disconnect
            } catch (error) {
                // Seems to be a real disconnect which SHOULDN'T be recovered from
                connection.destroy();
            }
        })
    }

    // Temp fix for Discord UDP packet issue
    if (connection.listenerCount('stateChange') === 0) {
        connection.on('stateChange', (oldState, newState) => {
            const oldNetworking = Reflect.get(oldState, 'networking');
            const newNetworking = Reflect.get(newState, 'networking');
            oldNetworking?.setMaxListeners(1);
            newNetworking?.setMaxListeners(1);

            const networkStateChangeHandler = (oldNetworkState: any, newNetworkState: any) => {
                const newUdp = Reflect.get(newNetworkState, 'udp');
                clearInterval(newUdp?.keepAliveInterval);
            }

            oldNetworking?.off('stateChange', networkStateChangeHandler);
            newNetworking?.on('stateChange', networkStateChangeHandler);
        });
    }
}

// Join voice channel and play audio
function playAudioFile(audioFie: string, username?: string): void {
    console.log(`[${new Date().toLocaleTimeString('en-US')}] ${username} played ${audioFie}`);
    if (connection) connection.subscribe(player);
    const resource = createAudioResource(join(__dirname, `audio/${audioFie}.mp3`));
    player.play(resource);
}

// Responses to text messages
client.on(Events.MessageCreate, async (message: Message): Promise<void> => {
    // Don't respond to bots
    if (message.author.bot) return;
    // Don't respond to Bot Abuser role
    if (message.member && message.member.roles.cache.some(role => role.name === 'Bot Abuser')) return;
    //
    if (message.channel.type !== ChannelType.GuildText) return;

    const command = message.content.toLowerCase();

    //React with emoji
    for (const regexReact of regexToReact) {
        const react = regexReact.getReact()
        if (react && regexReact.regex.test(command)) {
            message.react(react);
        }
    }
    // Text replies
    let botMessage = '';
    for (let regexText of regexToText) {
        if (regexText.regex.test(command) && message.member) {
            const text = regexText.getText(command, message.member?.displayName);
            botMessage += `${text}\n`;
        }
    }
    // Send message
    if (botMessage) {
        message.channel.send(botMessage).catch((e) => console.log(`Error sending message: ${e}`));;
    }
    // Audio replies
    for (let regexAudio of regexToAudio) {
        const audio = regexAudio.getAudio();
        if (regexAudio.regex.test(command) && audio && message.member && message.member.voice.channel && message.guild) {
            const voiceConnection = {
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
                selfDeaf: false
            }
            joinVoice(voiceConnection);
            playAudioFile(audio, message.member.user.username);
            break;
        }
    }
});

// Slash commands
client.on(Events.InteractionCreate, async (interaction: Interaction): Promise<void> => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    // Play audio
    if (commandName === 'play' && interaction.member instanceof GuildMember && interaction.guild && interaction.member.voice.channel) {
        const voiceConnection = {
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator,
            selfDeaf: false
        }
        joinVoice(voiceConnection);
        playAudioFile(interaction.options.getString('audio') ?? '', interaction.member.user.username)
        const reply = interaction.member.voice ? `Playing ${interaction.options.getString('audio')}.` : 'You are not in a voice channel.';
        await interaction.reply({ content: reply, ephemeral: true });
    }
    // Reply with a number between 1 and 100 (or min and max)
    else if (commandName === 'roll') {
        const min = interaction.options.getInteger('min') ?? 1;
        const max = interaction.options.getInteger('max') ?? 100;
        await interaction.reply(Math.floor(Math.random() * (max + 1 - min) + min).toString());
    }
});

// On channel move/mute/deafen
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    // Return if incorrect guild
    if (oldState.guild.id !== process.env.GUILD_ID) return;
    // Message when Azi leaves or chance when someone else leaves
    if ((newState.member?.id == process.env.AZI_ID || Math.random() < 0.10) && newState.channelId == null) {
        if (mainChannel && mainChannel.type === ChannelType.GuildText) {
            mainChannel.send('You made Azi leave.').catch((e) => console.log(`Error sending to mainChannel: ${e}`));
        }
    }

    // Return if voice state update is itself
    if (oldState.id === client.user?.id) return;

    // Play teleporting fat guy when moving between channels
    if (oldState.channelId && newState.channelId && oldState.channelId != newState.channelId) {
        const voiceConnection = {
            channelId: newState.channelId,
            guildId: newState.guild.id,
            adapterCreator: newState.guild.voiceAdapterCreator
        }
        joinVoice(voiceConnection);
        playAudioFile('teleporting_fat_guy', oldState.member?.user.username);
    }

    // Play Good Morning Donda when joining channel in the morning
    if (newState.channelId && oldState.channelId == null) {
        const hour = moment().utc().tz('America/Toronto').hour();
        if (hour >= 4 && hour < 12) {
            const voiceConnection = {
                channelId: newState.channelId,
                guildId: newState.guild.id,
                adapterCreator: newState.guild.voiceAdapterCreator
            }
            joinVoice(voiceConnection);
            playAudioFile('good_morning_donda', oldState.member?.user.username);
        }
    }
});

// Cronjobs
// Hourly water and posture check cronjob
// const waterPostureCheckScheduledMessage = new cron.CronJob('00 00 * * * *', (): void => {
//     const channel = client.channels.cache.get('899162908498468934');
//     if (channel && channel instanceof TextChannel) {
//         channel.send('<@&899160433548722176> Water Check. Posture Check.');
//     }
//     else {
//         console.log('Water/Posture Check channel not found.');
//     }
// });
// waterPostureCheckScheduledMessage.start();

// Daily Wordle reminder cronjob
const wordleScheduledMessage = new cron.CronJob(
    '00 00 00 * * *',
    (): void => {
        const channel = client.channels.cache.get('933772784948101120');
        if (channel && channel.type === ChannelType.GuildText) {
            channel.send('Wordle time POGCRAZY');
        }
        else {
            console.log('Wordle channel not found.');
        }
    },
    null,
    true,
    'America/Toronto'
);
wordleScheduledMessage.start();

// Weekly Tuesday WoW Reset cronjob
const WoWResetScheduledMessage = new cron.CronJob(
    '00 00 17 * * 2',
    (): void => {
        const channel = client.channels.cache.get('158049091434184705');
        if (channel && channel.type === ChannelType.GuildText) {
            channel.send('When Mythic+/Vault of the Incarnates/World Boss/PvP/Timewalking');
        }
        else {
            console.log('WoW text channel not found.');
        }
    },
    null,
    true,
    'America/Toronto'
);
WoWResetScheduledMessage.start();

// Login with bot token
client.login(process.env.BOT_TOKEN);
client.once(Events.ClientReady, (): void => {
    // Add emotes from server to emotes object
    getEmotes(client);
    let channel = client.channels.cache.get(process.env.MAIN_CHANNEL_ID ?? '');
    if (channel && channel.type === ChannelType.GuildText) {
        mainChannel = channel;
    }
    channel = client.channels.cache.get(process.env.VOICE_LOG_CHANNEL_ID ?? '');
    if (channel && channel.type === ChannelType.GuildText) {
        voiceLogChannel = channel;
    }
    console.log('Same5JokesBot online.');
});

const express = require('express');
const app = express();
const port = process.env.PORT || 3001;

app.get('/', (_req, res, _next) => {
    const healthcheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
    };
    try {
        res.send(healthcheck);
    } catch (error) {
        healthcheck.message = error;
        res.status(503).send();
    }
});
app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});