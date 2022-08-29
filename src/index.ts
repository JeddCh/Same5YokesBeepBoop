import { Client, Intents, Message, TextChannel, Interaction, GuildMember } from "discord.js";
import { VoiceConnection, joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, DiscordGatewayAdapterCreator } from "@discordjs/voice";
import { join } from 'node:path';
import * as dotenv from 'dotenv'
dotenv.config()
import cron from 'cron';
import regexToText from './regexToText';
import regexToAudio from './regexToAudio';
import regexToReact from "./regexToReact";
import { getEmotes } from './emotes'

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });

const player = createAudioPlayer();
let timeoutId: NodeJS.Timer | null = null;
let connection: VoiceConnection;
// Disconnect after 5 min of inactivity
player.on(AudioPlayerStatus.Playing, (): void => {
    if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
    }
});
player.on(AudioPlayerStatus.Idle, (): void => {
    player.stop();
    timeoutId = setTimeout(() => {
        connection.disconnect();
        timeoutId = null;
    }, 300000);
});

// Join voice channel and play audio
interface voiceConnection {
    channelId: string,
    guildId: string,
    adapterCreator: DiscordGatewayAdapterCreator
}
function playAudioFile(username: string, voiceConnection: voiceConnection, audioFie: string): void {
    console.log(`[${new Date().toLocaleTimeString('en-US')}] ${username} played ${audioFie}`);
    connection = joinVoiceChannel(voiceConnection);
    connection.subscribe(player);
    const resource = createAudioResource(join(__dirname, `audio/${audioFie}.mp3`));
    player.play(resource);
}

// Responses to text messages
client.on('messageCreate', async (message: Message): Promise<void> => {
    // Don't respond to bots
    if (message.author.bot) return;
    // Don't respond to Bot Abuser role
    if (message.member && message.member.roles.cache.some(role => role.name === 'Bot Abuser')) return;

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
        if (regexText.regex.test(command)) {
            botMessage += `${regexText.getText()}\n`;
        }
    }
    // Send message
    if (botMessage) {
        message.channel.send(botMessage);
    }

    // Audio replies
    for (let regexAudio of regexToAudio) {
        if (regexAudio.regex.test(command) && message.member && message.member.voice.channel && message.guild) {
            const voiceConnection = {
                channelId: message.member.voice.channel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator
            }
            playAudioFile(message.member.user.username, voiceConnection, regexAudio.audio);
            break;
        }
    }
});

// Slash commands
client.on('interactionCreate', async (interaction: Interaction): Promise<void> => {
    if (!interaction.isCommand()) return;
    const { commandName } = interaction;
    // Play audio
    if (commandName === 'play' && interaction.member instanceof GuildMember && interaction.guild && interaction.member.voice.channel) {
        const voiceConnection = {
            channelId: interaction.member.voice.channel.id,
            guildId: interaction.guild.id,
            adapterCreator: interaction.guild.voiceAdapterCreator
        }
        playAudioFile(interaction.member.user.username, voiceConnection, interaction.options.getString('audio') ?? '')
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

// Hourly water and posture check cronjob
const waterPostureCheckScheduledMessage = new cron.CronJob('00 00 * * * *', (): void => {
    const channel = client.channels.cache.get('899162908498468934');
    if (channel && channel instanceof TextChannel) {
        channel.send('<@&899160433548722176> Water Check. Posture Check.');
    }
    else {
        console.log('Water/Posture Check channel not found.');
    }
});
waterPostureCheckScheduledMessage.start();

// Daily Wordle reminder cronjob
const wordleScheduledMessage = new cron.CronJob('00 00 00 * * *', (): void => {
    const channel = client.channels.cache.get('933772784948101120');
    if (channel && channel instanceof TextChannel) {
        channel.send('Wordle time POGCRAZY');
    }
    else {
        console.log('Wordle channel not found.');
    }
});
wordleScheduledMessage.start();

// Weekly Wednesday Lost Ark Reset cronjob
const lostArkResetScheduledMessage = new cron.CronJob('00 00 17 * * 3', (): void => {
    const channel = client.channels.cache.get('158049091434184705');
    if (channel && channel instanceof TextChannel) {
        channel.send('When Argos/Vykas/Challenge Guardian/Challenge Abyssal/Valtan/Oreha/Div/Val/City Guesser');
    }
    else {
        console.log('Lost Ark Reset channel not found.');
    }
});
wordleScheduledMessage.start();

client.login(process.env.BOT_TOKEN);
client.once('ready', (): void => {
    console.log('Same5JokesBot online.');
    // Add emotes from server to emotes object
    getEmotes(client);
});