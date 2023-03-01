import { emotes } from './emotes';

const regexToReact = [
    {
        regex: /cooler/,
        getReact: () => '🐟'
    },
    {
        regex: /shut.*up/,
        getReact: () => emotes.smoshShutUp ?? ''
    },
    {
        regex: /^\ba\b$/,
        getReact: () => new Date().getMonth() == 1 ? '🚕' : ''
    },
    {
        regex: /anime|vtuber/,
        getReact: () => emotes.dansGame ?? ''
    }
]

export default regexToReact;
