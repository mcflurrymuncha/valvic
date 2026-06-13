const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // If you are using prefix commands instead of slash commands:
    name: 'say',
    description: 'Repeats what you say anonymously.',
    async execute(message, args) {
        // 1. Check if the user actually provided text
        const textToSay = args.join(' ');
        if (!textToSay) {
            return message.reply('You need to provide a message for me to say!');
        }

        // 2. Delete the user's original message immediately
        try {
            await message.delete();
        } catch (error) {
            console.error('Failed to delete the message:', error);
            // Optional: Let the user know if permissions are missing
        }

        // 3. Send the content as the bot
        await message.channel.send(textToSay);
    },
};