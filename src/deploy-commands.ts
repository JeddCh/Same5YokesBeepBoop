import { SlashCommandBuilder, REST } from 'discord.js';
import { Routes } from 'discord-api-types/v9';
import * as dotenv from 'dotenv';
dotenv.config();

const playCommand = new SlashCommandBuilder()
	.setName('play')
	.setDescription('Plays selected audio clip')
	.addStringOption((option) =>
		option
			.setName('audio')
			.setDescription('Audio clip')
			.setRequired(true)
			.addChoices(
				{ name: 'Thunder vs Lightning', value: 'thunder_vs_lightning' },
				/*
				{ name: 'Phasmo Breath', value: 'phasmo_breath' },
				{ name: 'Phasmo Die', value: 'phasmo_die' },
				{ name: 'Phasmo Groan', value: 'phasmo_groan' },
				{ name: 'Phasmo Heartbeat', value: 'phasmo_heartbeat' },
				{ name: 'Phasmo Kill', value: 'phasmo_kill' },
				{ name: 'Phasmo Behind', value: 'phasmo_behind' },
				{ name: 'Phasmo Here', value: 'phasmo_here' },
				*/
				{ name: 'Among Us Emergency Meeting', value: 'amongus_meeting' },
				{ name: 'Disgustang', value: 'disgustang' },
				{ name: 'Demon Time', value: 'demontime' },
				{ name: 'What the dog doin', value: 'whatthedogdoin' },
				{ name: 'Beans', value: 'beans' },
				{ name: 'Beans Slow', value: 'beans_slow' },
				{ name: 'NOIDONTTHINKSO', value: 'NOIDONTTHINKSO' },
				{ name: 'Uh guys?', value: 'uhguys' },
				{ name: 'ENOUGH TALK', value: 'ENOUGHTALK' },
				{ name: 'Champ Select', value: 'champ_select' },
				{ name: 'TRUE', value: 'TRUE' },
				{ name: 'Moonmoon destroys Weebs', value: 'moonmoon_destroys_weebs' },
				{ name: 'Bing Chilling', value: 'bing_chilling' },
				{ name: 'An Exclusive! It Arrived', value: 'an_exclusive_it_arrived' },
				{ name: 'Smosh: Shut Up!', value: 'smosh_shut_up' },
				{ name: 'Get ready! M.O.A.B.!', value: 'get_ready_MOAB' },
				{ name: 'Clean-cut, and still cuts a tomato.', value: 'clean_cuts' },
				{ name: 'Game over, man.', value: 'game_over_man' },
				{ name: 'Fulcrum, come in', value: 'fulcrum_come_in' },
				{ name: 'Obliterated', value: 'obliterated' },
				{ name: 'FADEDTHANAHO', value: 'FADEDTHANAHO' },
				{ name: 'Good Morning Donda', value: 'good_morning_donda' },
				{ name: 'Teleporting Fat Guy', value: 'teleporting_fat_guy' },
				{ name: 'Guga', value: 'guga' },
			)
	);

const rollCommand = new SlashCommandBuilder()
	.setName('roll')
	.setDescription('Rolls a random number from 1 to 100 (or min and max)')
	.addIntegerOption((option) => option.setName('min').setDescription('Enter an integer'))
	.addIntegerOption((option) => option.setName('max').setDescription('Enter an integer'));
const commands = [playCommand, rollCommand].map((command) => command.toJSON());

if (process.env.BOT_TOKEN && process.env.CLIENT_ID && process.env.GUILD_ID) {
	const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);
	rest
		.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
			body: commands,
		})
		.then(() => console.log('Successfully registered application commands.'))
		.catch(console.error);
}
