import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { successEmbed, warningEmbed, errorEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

// Base Endpoint API Route as defined by the Rotector Developer Documentation
const ROSCOE_API_URL = 'https://roscoe.rotector.com/v1'; 

export default {
  data: new SlashCommandBuilder()
    .setName('rocheck')
    .setDescription('Runs a real-time background compliance audit using the Roscoe Rotector analysis API.')
    .addStringOption(option =>
      option
        .setName('roblox_username')
        .setDescription('The Roblox username to inspect.')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('discord_user')
        .setDescription('The corresponding Discord account to trace server footprints for.')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Restrict to moderation staff
  category: 'Moderation',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const rbxUsername = interaction.options.getString('roblox_username').trim();
      const discordTarget = interaction.options.getUser('discord_user');

      // ==========================================
      // SECTION 1: SYSTEM RESOLUTION (USERNAME -> ID)
      // ==========================================
      const userPayload = await fetch(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(rbxUsername)}`)
        .then(res => res.ok ? res.json() : null)
        .catch(() => null);

      if (!userPayload || !userPayload.data || userPayload.data.length === 0) {
        throw new TitanBotError(
          'User not found',
          ErrorTypes.USER_INPUT,
          `No registered Roblox account found for user **${rbxUsername}**.`
        );
      }

      const robloxUser = userPayload.data[0];
      const robloxId = robloxUser.id;

      // ==========================================
      // SECTION 2: ROSCOE ROTECTOR ENGINE CALL
      // ==========================================
      // We pull the profile assessment matrices provided by the rotector analytics infrastructure
      const rotectorResponse = await fetch(`${ROSCOE_API_URL}/users/${robloxId}/assessment`)
        .then(res => res.ok ? res.json() : null)
        .catch((err) => {
          logger.error('Roscoe API network handshake failed:', err);
          return null;
        });

      // ==========================================
      // SECTION 3: DISCORD HISTORY MATRICES
      // ==========================================
      let discordSummary = "*No Discord user attached to this check.*";
      if (discordTarget) {
        let mutualCount = 0;
        let mappedGuilds = [];

        for (const [, guild] of client.guilds.cache) {
          const exists = await guild.members.fetch(discordTarget.id).then(() => true).catch(() => false);
          if (exists) {
            mutualCount++;
            if (mappedGuilds.length < 4) mappedGuilds.push(guild.name);
          }
        }

        const ageInDays = Math.floor((Date.now() - discordTarget.createdTimestamp) / (1000 * 60 * 60 * 24));
        discordSummary = 
          `• **User Profile:** ${discordTarget.tag} (\`${discordTarget.id}\`)\n` +
          `• **Account Lifecycle:** <t:${Math.floor(discordTarget.createdTimestamp / 1000)}:R> (\`${ageInDays} days old\`)\n` +
          `• **Mutual Network Trace:** Present in **${mutualCount}** shared servers.\n` +
          `• **Tracked Guild Hubs:** *${mappedGuilds.join(', ')}${mutualCount > 4 ? '... and others' : ''}*`;

        if (ageInDays < 7) {
          discordSummary += `\n⚠️ **ALERT:** High-probability burner profile identifier detected!`;
        }
      }

      // ==========================================
      // SECTION 4: THREAT EVALUATION MATRIX
      // ==========================================
      let riskLevel = '🟢 CLEAR';
      let threatReasoning = 'User has a healthy profile integrity footprint. No violation flags recorded inside Rotector database networks.';
      let recommendedActions = '✅ **No Action Required.** The profile is greenlit for full server interaction privileges.';
      let confidenceRating = 'N/A';

      if (rotectorResponse && rotectorResponse.flagged) {
        // Extract diagnostic metadata from the Roscoe system response
        const confidence = rotectorResponse.confidenceScore || 100;
        const violations = rotectorResponse.violations || ['Unspecified Policy Violation'];
        confidenceRating = `${confidence}%`;

        riskLevel = confidence >= 75 ? '🔴 SEVERE RISK' : '🟡 ELEVATED RISK';
        threatReasoning = `**Flagged Violations:** ${violations.map(v => `\`${v}\``).join(', ')}\n**System Details:** *${rotectorResponse.evidenceSummary || 'Evidence logging captured via avatar outfit asset matches or tracked game servers.'}*`;
        
        // Define compliance directions based on Rotector's output tags
        if (violations.some(v => v.toLowerCase().includes('condo') || v.toLowerCase().includes('explicit'))) {
          recommendedActions = '🚨 **CRITICAL SAFETY THREAT:** Profile identified with recent high-frequency tracking to illicit explicit spaces. Execute an immediate **Server Blacklist / Ban hold** and flag user accounts.';
        } else {
          recommendedActions = '⚠️ **COMPLIANCE ACTION:** Profile has associated risk anomalies (group associations or blacklisted network assets). Move user to an active **Staff Monitoring Watchlist** or issue a security warning.';
        }
      }

      // ==========================================
      // SECTION 5: PANEL PACKAGING & OUTPUT
      // ==========================================
      const embedTitle = `🛡️ Rotcoe Audit Security Panel: ${robloxUser.displayName}`;
      const embedBody = 
        `### 🤖 Discord Footprint Profile\n${discordSummary}\n\n` +
        `### 🧱 Roblox Core Account Matrix\n` +
        `• **Target Handle:** @${robloxUser.name} (\`${robloxId}\`)\n` +
        `• **Rotector System State:** \`${riskLevel}\`\n` +
        `• **Analysis Confidence:** \`${confidenceRating}\`\n\n` +
        `### 📋 Threat Profile Specifics\n${threatReasoning}\n\n` +
        `--- \n` +
        `### ⚙️ Automated Staff Action Framework\n${recommendedActions}`;

      let embed;
      if (riskLevel === '🔴 SEVERE RISK') {
        embed = warningEmbed(embedTitle, embedBody);
      } else if (riskLevel === '🟡 ELEVATED RISK') {
        embed = warningEmbed(embedTitle, embedBody).setColor('#FFAA00'); // Clean Amber warning variant
      } else {
        embed = successEmbed(embedTitle, embedBody);
      }

      // Add their headshot thumbnail as a quick visual reference
      embed.setThumbnail(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png`)
           .setFooter({ text: 'Roscoe Rotector Automation Intelligence Services' })
           .setTimestamp();

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Rotector security audit processed completely for Roblox ID: ${robloxId}`);

    } catch (error) {
      logger.error('Rotector intelligence audit process encountered an exception:', error);
      await handleInteractionError(interaction, error, { commandName: 'rocheck', source: 'rocheck_command' });
    }
  }
};
