import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rocheck')
    .setDescription('BETA Runs an advanced cross-platform background diagnostic on a user across Roblox and Discord.')
    .addStringOption(option =>
      option
        .setName('roblox_username')
        .setDescription('The Roblox username to target.')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('discord_user')
        .setDescription('The suspect Discord account to map history for.')
        .setRequired(false)
    ),
  category: 'Moderation',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const rbxUsername = interaction.options.getString('roblox_username').trim();
      const discordTarget = interaction.options.getUser('discord_user');

      // ==========================================
      // SECTION 1: DISCORD HISTORICAL SCAN
      // ==========================================
      let discordHistoryString = "*No Discord user attached to this check.*";
      let mutualServerCount = 0;
      let sharedGuildNames = [];

      if (discordTarget) {
        // Sweep through the entire bot shard cache to track everywhere this user co-exists
        for (const [, guild] of client.guilds.cache) {
          try {
            const hasMember = await guild.members.fetch(discordTarget.id).then(() => true).catch(() => false);
            if (hasMember) {
              mutualServerCount++;
              // Save up to 5 names for visual spacing in embeds
              if (sharedGuildNames.length < 5) sharedGuildNames.push(guild.name);
            }
          } catch {
            // Suppress background cache misses quietly
          }
        }

        const accountAgeDays = Math.floor((Date.now() - discordTarget.createdTimestamp) / (1000 * 60 * 60 * 24));
        const discordCreated = `<t:${Math.floor(discordTarget.createdTimestamp / 1000)}:R>`;

        discordHistoryString = 
          `• **User Identification:** ${discordTarget.tag} (\`${discordTarget.id}\`)\n` +
          `• **Account Created:** ${discordCreated} (\`${accountAgeDays} days old\`)\n` +
          `• **Shared Network Footprint:** Tracked inside **${mutualServerCount}** guilds managed by this bot.\n` +
          `• **Tracked Servers:** *${sharedGuildNames.join(', ')}${mutualServerCount > 5 ? '... and others' : ''}*`;
          
        // Flag warning if a Discord account is less than a week old
        if (accountAgeDays < 7) {
          discordHistoryString += `\n🚨 **DISCORD RISK WARNING:** Extremely new user account! High threat indicator for ban-evasion.`;
        }
      }

      // ==========================================
      // SECTION 2: ROBLOX METADATA SCAN
      // ==========================================
      const userPayload = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(rbxUsername)}`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);

      if (!userPayload || !userPayload.data || userPayload.data.length === 0) {
        throw new TitanBotError(
          'User not found',
          ErrorTypes.USER_INPUT,
          `No registered Roblox account found for **${rbxUsername}**.`
        );
      }

      const target = userPayload.data[0];
      const userId = target.id;

      // Extract raw site presence data
      const presencePayload = await fetch('https://presence.roblox.com/v1/presence/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId] })
      })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);

      const userPresence = presencePayload?.userPresences?.[0];
      let activityStatus = '🔒 Private Settings / Unknown';
      let flaggedActivity = false;

      if (userPresence) {
        if (userPresence.userPresenceType === 2) {
          activityStatus = `🎮 Playing Game ID: \`${userPresence.placeId}\``;
          // Trigger flag rule if hidden instance routing is detected
          if (userPresence.gameId && !userPresence.lastLocation) flaggedActivity = true;
        } else if (userPresence.userPresenceType === 1) {
          activityStatus = '🌐 Online (Browsing Website)';
        } else if (userPresence.userPresenceType === 3) {
          activityStatus = '🛠️ Designing inside Roblox Studio';
        } else {
          activityStatus = '⚫ Offline';
        }
      }

      // Track account age metrics on Roblox
      const accountDetails = await fetch(`https://users.roblox.com/v1/users/${userId}`).then(res => res.json());
      let rbxAgeString = 'Unknown';
      let rbxDaysOld = 999;

      if (accountDetails && accountDetails.created) {
        const createdDate = new Date(accountDetails.created);
        rbxDaysOld = Math.floor((Date.now() - createdDate) / (1000 * 60 * 60 * 24));
        rbxAgeString = `${createdDate.toLocaleDateString()} (${rbxDaysOld} days old)`;
      }

      // ==========================================
      // SECTION 3: DECISION MATRIX
      // ==========================================
      let riskLevel = '🟢 LOW';
      let recommendations = '✅ **Clear.** Profile properties exist within standard operational boundaries.';

      if (rbxDaysOld < 30 || (discordTarget && mutualServerCount > 3)) {
        riskLevel = '🟡 MEDIUM RISK';
        recommendations = '⚠️ **Watchlist Notification:** Fresh Roblox account configuration detected or extensive multiserver cross-joins. Keep on watchlists.';
      }

      if (flaggedActivity || (discordTarget && (Math.floor((Date.now() - discordTarget.createdTimestamp) / (1000 * 60 * 60 * 24)) < 7))) {
        riskLevel = '🔴 HIGH RISK';
        recommendations = '🚨 **Action Priority:** High probability of explicit exploit engagement or multi-account ban evasion. Monitor live channel logs or issue a proactive server restriction hold.';
      }

      // ==========================================
      // SECTION 4: DISPLAY COMPILATION
      // ==========================================
      const embedTitle = `🛡️ Cross-Platform Audit: ${target.displayName} (@${target.name})`;
      const embedBody = 
        `### 🤖 Discord Footprint History\n${discordHistoryString}\n\n` +
        `### 🧱 Roblox Target Verification\n` +
        `• **Account ID:** \`${userId}\`\n` +
        `• **Profile Age:** \`${rbxAgeString}\`\n` +
        `• **Live State:** ${activityStatus}\n\n` +
        `--- \n` +
        `### 📊 Threat Assessment Rating\n` +
        `**Classification:** \`${riskLevel}\`\n` +
        `**Action Framework:** ${recommendations}`;

      let embed = (riskLevel === '🔴 HIGH RISK') ? warningEmbed(embedTitle, embedBody) : successEmbed(embedTitle, embedBody);
      embed.setThumbnail(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`);

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Comprehensive audit completed for ${rbxUsername} / User mapping pointer: ${discordTarget?.id || 'none'}`);

    } catch (error) {
      logger.error('Advanced multi-audit background processing failure:', error);
      await handleInteractionError(interaction, error, { commandName: 'rocheck', source: 'rocheck_command' });
    }
  }
};
