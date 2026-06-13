import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

function stringToHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates a dynamic blended ship name based on two input names.
 */
function generateShipName(name1, name2) {
  // Clean names to strip out common mention characters or special punctuation if they exist
  const clean1 = name1.replace(/[^a-zA-Z0-9]/g, '');
  const clean2 = name2.replace(/[^a-zA-Z0-9]/g, '');

  // Fallback if regex empties the string entirely
  if (clean1.length < 2 || clean2.length < 2) {
    return `${name1.substring(0, Math.ceil(name1.length / 2))}${name2.substring(Math.floor(name2.length / 2))}`;
  }

  // Take the first half of the first name and the second half of the second name
  const part1 = clean1.substring(0, Math.ceil(clean1.length / 2));
  const part2 = clean2.substring(Math.floor(clean2.length / 2));

  // Capitalize the first letter of the combined name cleanly
  const combined = part1 + part2;
  return combined.charAt(0).toUpperCase() + combined.slice(1).toLowerCase();
}

export default {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Calculate the compatibility score between two people.")
    .addStringOption((option) =>
      option
        .setName("name1")
        .setDescription("The first name or user.")
        .setRequired(true)
        .setMaxLength(100),
    )
    .addStringOption((option) =>
      option
        .setName("name2")
        .setDescription("The second name or user.")
        .setRequired(true)
        .setMaxLength(100),
    ),
  category: 'Fun',

  async execute(interaction, config, client) {
    try {
      await InteractionHelper.safeDefer(interaction);

      const name1Raw = interaction.options.getString("name1");
      const name2Raw = interaction.options.getString("name2");

      if (!name1Raw || name1Raw.trim().length === 0 || !name2Raw || name2Raw.trim().length === 0) {
        throw new TitanBotError(
          'Empty names provided to ship command',
          ErrorTypes.USER_INPUT,
          'Please provide valid names for both people!'
        );
      }

      const name1 = sanitizeInput(name1Raw.trim(), 100);
      const name2 = sanitizeInput(name2Raw.trim(), 100);

      // We sort the names for the hash determination so "Alice + Bob" yields 
      // the exact same score and ship name as "Bob + Alice"
      const sortedNames = [name1, name2].sort();
      const combination = sortedNames.join("-").toLowerCase();
      const score = stringToHash(combination) % 101;

      // Generate the unique ship name using the sorted name matrix
      const shipName = generateShipName(sortedNames[0], sortedNames[1]);

      let description;
      if (score === 100) {
        description = "Soulmates! It's destiny, they belong together!";
      } else if (score >= 80) {
        description = "A perfect match! Get the wedding bells ready!";
      } else if (score >= 60) {
        description = "Solid chemistry. Definitely worth exploring!";
      } else if (score >= 40) {
        description = "Just friends status. Maybe with time?";
      } else if (score >= 20) {
        description = "It's a struggle. They might need space.";
      } else {
        description = "sybau twin";
      }

      const progressBar =
        "█".repeat(Math.floor(score / 10)) +
        "░".repeat(10 - Math.floor(score / 10));

      // The dynamic ship name is now the main focal point of the title
      const embed = successEmbed(
        `💞 The Official Ship Name: ${shipName}`,
        `**Match:** ${name1} x ${name2}\n**Compatibility:** ${score}%\n\n\`${progressBar}\`\n\n*${description}*`,
      );

      await InteractionHelper.safeEditReply(interaction, { embeds: [embed] });
      logger.debug(`Ship command executed by user ${interaction.user.id} in guild ${interaction.guildId}`);
    } catch (error) {
      logger.error('Ship command error:', error);
      await handleInteractionError(interaction, error, {
        commandName: 'ship',
        source: 'ship_command'
      });
    }
  },
};