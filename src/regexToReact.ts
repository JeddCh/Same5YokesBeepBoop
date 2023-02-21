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
        getReact: () => '🚕'
    }
]

export default regexToReact;
