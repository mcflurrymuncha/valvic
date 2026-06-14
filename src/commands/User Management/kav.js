import { SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// Replace this with your revival's actual backend API host link
const REVIVAL_API_URL = 'https://api.pekora.zip/v1'; 

export default {
  data: new SlashCommandBuilder()
    .setName('kav')
    .setDescription("Fetches a user's avatar from Korone by username.")
    .addStringOption(option =>
      option
        .setName('username')
        .setDescription('The username of the player you want to look up.')
        .setRequired(true)
        .setMaxLength(50)
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const username = interaction.options.getString('username').trim();

      // 1. Fetch the user profile data from your website's API
      const response = await fetch(`${REVIVAL_API_URL}/users/profile?username=${encodeURIComponent(username)}`)
        .catch((err) => {
          logger.error('API connection failed:', err);
          return null;
        });

      if (!response || !response.ok) {
        throw new TitanBotError(
          'API unreachable',
          ErrorTypes.API,
          'Could not establish a connection to the revival service database.'
        );
      }

      const userData = await response.json();

      // 2. Validate that the user exists and grab their dynamic avatar thumbnail hash identifier
      // Adjust 'userData.avatarHash' or 'userData.id' depending on what your API returns!
      const fetchedHash = userData?.avatarHash || userData?.thumbnailHash; 
      const trueUsername = userData?.username || username;

      if (!fetchedHash) {
        throw new TitanBotError(
          'User not found',
          ErrorTypes.USER_INPUT,
          `Could not find an active player named **${username}**, or they do not have an active avatar render.`
        );
      }

      // 3. Assemble your cdn.pekora.zip file structure seamlessly
      const fullCdnUrl = `https://cdn.pekora.zip/images/thumbnails/${fetchedHash}_thumbnail.png`;

      const embed = successEmbed(
        `🦊 Korone Revival Avatar: ${trueUsername}`,
        `**User Identification:** \`${userData?.id || 'N/A'}\`\n\n[Open Direct High-Res Image Link](${fullCdnUrl})`
      )
      .setImage(fullCdnUrl)
      .setFooter({ text: 'www.pekora.zip' })
      .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Successfully parsed username "${username}" to hash code: ${fetchedHash}`);

    } catch (error) {
      logger.error('Korone username look-up command error:', error);
      await handleInteractionError(interaction, error, { commandName: 'kav', source: 'kav_username_command' });
    }
  }
};
