import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// NOTE: Import your database models or helper functions here.
// Replace these placeholders with your actual data fetching methods.
async function getUserEconomyData(userId, guildId) {
  // Example placeholder logic:
  // return await EconomyModel.findOne({ userId, guildId }) || { wallet: 0, bank: 0 };
  return { wallet: 500, bank: 1500 }; 
}

async function getUserLevelingData(userId, guildId) {
  // Example placeholder logic:
  // return await LevelingModel.findOne({ userId, guildId }) || { level: 1, xp: 0 };
  return { level: 12, xp: 4250, nextLevelXp: 5000 }; 
}

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription("View your profile card or another member's profile.")
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('The user whose profile you want to view.')
        .setRequired(false)
    ),
  category: 'Utility',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      // Target defaults to the user executing the command if no one else is specified
      const targetUser = interaction.options.getUser('target') || interaction.user;
      const member = await interaction.guild.members.fetch(targetUser.id);

      // Fetch data simultaneously from your existing database wrappers
      const [economy, leveling] = await Promise.all([
        getUserEconomyData(targetUser.id, interaction.guildId),
        getUserLevelingData(targetUser.id, interaction.guildId)
      ]);

      // Calculate progress bar for leveling
      const xpPercent = Math.min(Math.round((leveling.xp / leveling.nextLevelXp) * 100), 100);
      const progressBarLength = 10;
      const filledBlocks = Math.floor(xpPercent / (100 / progressBarLength));
      const xpBar = "🟩".repeat(filledBlocks) + "⬛".repeat(progressBarLength - filledBlocks);

      // Format financial data
      const totalWealth = economy.wallet + economy.bank;

      // Construct a clean dashboard inside your native successEmbed layout
      const embed = successEmbed(
        `👤 ${targetUser.username}'s Server Profile`,
        `Showing community data for **${member.displayName}**`
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { 
          name: '📊 Progression & Levels', 
          value: `**Level:** \`${leveling.level}\`\n**XP:** \`${leveling.xp.toLocaleString()} / ${leveling.nextLevelXp.toLocaleString()}\` (${xpPercent}%)\n\`${xpBar}\``,
          inline: false 
        },
        { 
          name: '💰 Economy & Assets', 
          value: `💵 **Wallet:** \`$${economy.wallet.toLocaleString()}\`\n🏦 **Bank:** \`$${economy.bank.toLocaleString()}\`\n🌟 **Net Worth:** \`$${totalWealth.toLocaleString()}\``,
          inline: true 
        },
        { 
          name: '📅 Server Presence', 
          value: `📆 **Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n🚀 **Top Role:** ${member.roles.highest}`,
          inline: true 
        }
      )
      .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Profile card displayed for ${targetUser.id} by ${interaction.user.id}`);
      
    } catch (error) {
      logger.error('Profile command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'profile',
        source: 'profile_command'
      });
    }
  },
};
