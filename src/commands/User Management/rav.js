import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rav')
    .setDescription('Extracts a real-time full-body avatar render from official Roblox servers by username.')
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('The official Roblox username to fetch.')
        .setRequired(true)
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const username = interaction.options.getString('username').trim();

      // 1. Convert the plain text username into a real Roblox UserId
      const userPayload = await fetch('https://users.roblox.com/v1/users/search?keyword=' + encodeURIComponent(username))
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);

      // Validate that the user actually exists on Roblox
      if (!userPayload || !userPayload.data || userPayload.data.length === 0) {
        throw new TitanBotError(
          'Roblox user not found',
          ErrorTypes.USER_INPUT,
          `No official Roblox user found matching the name **${username}**.`
        );
      }

      // Filter exact name match from search array to ensure accuracy
      const targetUser = userPayload.data.find(
        u => u.name.toLowerCase() === username.toLowerCase() || u.displayName.toLowerCase() === username.toLowerCase()
      ) || userPayload.data[0];
      
      const userId = targetUser.id;

      // 2. Query official Roblox thumbnail CDN clusters for the full-body avatar render
      const thumbPayload = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);

      // Grab the URL from the payload array or fallback to a default image if Roblox CDN acts up
      const avatarUrl = thumbPayload?.data?.[0]?.imageUrl || 'https://tr.rbxcdn.com/30day-avatar-crop/420/420/Avatar/Png';

      // 3. Assemble and dispatch your custom success embed layout
      const embed = successEmbed(
        `🧱 Official Roblox Avatar: ${targetUser.displayName}`,
        `**System Tag:** \`@${targetUser.name}\`\n**Account ID:** \`${userId}\`\n\n[Download High-Res Render](${avatarUrl})`
      )
      .setImage(avatarUrl)
      .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Roblox user avatar view successfully compiled for ID ${userId}`);

    } catch (error) {
      logger.error('Rav command error:', error);
      await handleInteractionError(interaction, error, { commandName: 'rav', source: 'rav_command' });
    }
  }
};
