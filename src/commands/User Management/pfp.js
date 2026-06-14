import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('pfp')
    .setDescription("Fetches a user's high-resolution profile picture.")
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user whose avatar you want to view.')
        .setRequired(false)
    ),
  category: 'Utility',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const targetUser = interaction.options.getUser('target') || interaction.user;
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      const globalAvatar = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });
      
      const embed = successEmbed(
        `🖼️ ${targetUser.username}'s Avatar`,
        `[Click here for High-Res Link](${globalAvatar})`
      )
      .setImage(globalAvatar);

      // If they have a server-specific avatar overlay, show it as a thumbnail
      if (member && member.avatar && member.avatar !== targetUser.avatar) {
        const serverAvatar = member.displayAvatarURL({ dynamic: true, size: 512 });
        embed.setThumbnail(serverAvatar);
        embed.setDescription(`[Global Avatar Link](${globalAvatar}) | [Server Profile Avatar Link](${serverAvatar})\n*Thumbnail displays their server-specific avatar.*`);
      }

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Avatar fetched for ${targetUser.id} by ${interaction.user.id}`);
    } catch (error) {
      logger.error('Pfp command error:', error);
      await handleInteractionError(interaction, error, { commandName: 'pfp', source: 'pfp_command' });
    }
  }
};
