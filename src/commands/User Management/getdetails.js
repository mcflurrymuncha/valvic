import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('getdetails')
    .setDescription('Extracts exhaustive account metadata, presence, and permissions for a user.')
    .addUserOption(option =>
      option
        .setName('target')
        .setDescription('The user to analyze.')
        .setRequired(false)
    ),
  category: 'Utility',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const targetUser = interaction.options.getUser('target') || interaction.user;
      const member = await interaction.guild.members.fetch(targetUser.id);
      
      // 1. Gather Platform & Presence Statuses
      const presence = member.presence;
      let statusEmoji = '⚫ Offline';
      let clientDevices = 'None';
      let customStatus = 'None';
      let activities = [];

      if (presence) {
        const statusMap = { online: '🟢 Online', idle: '🌙 Idle', dnd: '🔴 Do Not Disturb', offline: '⚫ Offline' };
        statusEmoji = statusMap[presence.status] || '⚫ Offline';

        if (presence.clientStatus) {
          const devices = [];
          if (presence.clientStatus.desktop) devices.push('🖥️ Desktop');
          if (presence.clientStatus.mobile) devices.push('📱 Mobile');
          if (presence.clientStatus.web) devices.push('🌐 Web Browser');
          clientDevices = devices.join(', ');
        }

        // Parse through custom activities, games, or streams
        presence.activities.forEach(act => {
          if (act.type === 4) { // Custom Status type
            customStatus = `${act.emoji ? act.emoji.toString() + ' ' : ''}${act.state || ''}`;
          } else {
            const typeNames = ['Playing', 'Streaming', 'Listening to', 'Watching', 'Custom', 'Competing in'];
            activities.push(`**${typeNames[act.type] || 'Activity'}:** \`${act.name}\`${act.details ? ` (${act.details})` : ''}`);
          }
        });
      }

      // 2. Formatting Join/Creation Dates
      const createdTime = `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`;
      const joinedTime = `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`;

      // 3. Flags and Badges
      const userFlags = (await targetUser.fetchFlags()).toArray();
      const badges = userFlags.length > 0 ? userFlags.map(flag => `\`${flag}\``).join(', ') : 'None';

      // 4. Key Permissions Tracker
      const keyPerms = [];
      if (member.permissions.has(PermissionFlagsBits.Administrator)) keyPerms.push('Administrator');
      if (member.permissions.has(PermissionFlagsBits.ManageGuild)) keyPerms.push('Manage Server');
      if (member.permissions.has(PermissionFlagsBits.ManageRoles)) keyPerms.push('Manage Roles');
      if (member.permissions.has(PermissionFlagsBits.ManageChannels)) keyPerms.push('Manage Channels');
      if (member.permissions.has(PermissionFlagsBits.KickMembers)) keyPerms.push('Kick Members');
      if (member.permissions.has(PermissionFlagsBits.BanMembers)) keyPerms.push('Ban Members');
      const permString = keyPerms.length > 0 ? keyPerms.join(', ') : 'Regular Member';

      // 5. Construct the Master Info Embed
      const embed = successEmbed(
        `🔍 Detailed Metadata Analysis: ${targetUser.username}`,
        `Raw ID Pointer: \`${targetUser.id}\``
      )
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 Account Details', value: `**Tag:** ${targetUser.tag}\n**Bot?** \`${targetUser.bot ? 'Yes' : 'No'}\`\n**Profile Badges:** ${badges}`, inline: false },
        { name: '📡 Status and Activity', value: `**Status:** ${statusEmoji}\n**Active Clients:** \`${clientDevices}\`\n**Custom Status:** *${customStatus}*`, inline: false },
        { name: '📅 Time in Server:', value: `**Created Account:** ${createdTime}\n**Joined Server:** ${joinedTime}`, inline: false }
      );

      // Append additional fields if they are actively running software games/Spotify
      if (activities.length > 0) {
        embed.addFields({ name: '🎮 Currently Playing:', value: activities.join('\n'), inline: false });
      }

      embed.addFields(
        { name: '🛡️ Guild Hierarchy', value: `**Top Role:** ${member.roles.highest}\n**Key Admin Permissions:** \`${permString}\``, inline: false }
      )
      .setFooter({ text: `Diagnostics compiled for ${interaction.user.username}` })
      .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Comprehensive profile diagnostic executed on ${targetUser.id}`);
    } catch (error) {
      logger.error('Getdetails command error:', error);
      await handleInteractionError(interaction, error, { commandName: 'getdetails', source: 'getdetails_command' });
    }
  }
};
