import { Client, GuildEmoji } from 'discord.js';

// Object to store emotes
const emotes: { [key: string]: GuildEmoji | undefined } = {};

const getEmotes = (client: Client) => {
	emotes['sadge'] = client.emojis.cache.find((emoji: GuildEmoji) => emoji.name === 'Sadge');
	emotes['smoshShutUp'] = client.emojis.cache.find((emoji: GuildEmoji) => emoji.name === 'smoshShutUp');
	emotes['dansGame'] = client.emojis.cache.find((emoji: GuildEmoji) => emoji.name === 'DansGame');
};

export { emotes, getEmotes };
