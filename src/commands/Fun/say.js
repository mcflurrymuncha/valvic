import { SlashCommandBuilder } from 'discord.js';

export default {
    // 1. Define the Slash Command structure
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Repeats what you say anonymously.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The text you want the bot to repeat')
                .setRequired(true)
                .setMaxLength(2000) // Discord's maximum character limit
        ),

    // 2. Execute the Slash Command
    async execute(interaction) {
        // Retrieve the string option provided by the user
        const textToSay = interaction.options.getString('message');

        try {
            // Send the message directly to the channel the interaction took place in
            await interaction.channel.send(textToSay);

            // Acknowledge the interaction ephemerally so the user knows it worked, 
            // but nobody else in the server sees this confirmation.
            await interaction.reply({ 
                content: 'Message sent anonymously!', 
                ephemeral: true 
            });

        } catch (error) {
            // This will log directly to your custom logger if it's imported globally, 
            // otherwise standard console.error works safely here.
            console.error('Failed to execute say command:', error);
            
            // Handle cases where the bot might lack permissions to send messages in that channel
            await interaction.reply({ 
                content: 'There was an error trying to send your message. Make sure I have permission to speak here!', 
                ephemeral: true 
            });
        }
    },
};
