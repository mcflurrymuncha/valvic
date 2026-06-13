import { SlashCommandBuilder } from 'discord.js';
import { createEmbed, errorEmbed, successEmbed, infoEmbed, warningEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { handleInteractionError, TitanBotError, ErrorTypes } from '../../utils/errorHandler.js';
import { sanitizeInput } from '../../utils/sanitization.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

/**
 * Blends two names more naturally by cutting off at the first encountered vowel 
 * cluster to make the final ship name sound normal when spoken aloud.
 */
function generateNaturalShipName(name1, name2) {
  const clean1 = name1.replace(/[^a-zA-Z]/g, '');
  const clean2 = name2.replace(/[^a-zA-Z]/g, '');

  if (clean1.length < 3 || clean2.length < 3) {
    return `${name1.substring(0, Math.ceil(name1.length / 2))}${name2.substring(Math.floor(name2.length / 2))}`;
  }

  // Find a natural cutting point in the first name (after the first vowel sound)
  let cutIndex1 = Math.ceil(clean1.length / 2);
  const vowels = ['a', 'e', 'i', 'o', 'u', 'y'];
  
  for (let i = 1; i < clean1.length; i++) {
    if (vowels.includes(clean1[i].toLowerCase())) {
      cutIndex1 = i + 1; // Cut just after the vowel
      break;
    }
  }

  // Find a natural starting point for the second name (at the first vowel sound)
  let cutIndex2 = 0;
  for (let i = 0; i < clean2.length; i++) {
    if (vowels.includes(clean2[i].toLowerCase())) {
      cutIndex2 = i; // Blend starting right from their vowel sound
      break;
    }
  }

  const part1 = clean1.substring(0, cutIndex1);
  const part2 = clean2.substring(cutIndex2);

  const combined = part1 + part2;
  return combined.charAt(0).toUpperCase() + combined.slice(1).toLowerCase();
}

// Helper to grab a random element from an array
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

export default {
  data: new SlashCommandBuilder()
    .setName("ship")
    .setDescription("Calculate a completely random compatibility score between two people.")
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

      // 1. Generate a completely random score every time
      const score = Math.floor(Math.random() * 101);

      // Randomly mix up order for ship name creation so it doesn't always favor name1's prefix
      const blendOrder = Math.random() > 0.5 ? [name1, name2] : [name2, name1];
      const shipName = generateNaturalShipName(blendOrder[0], blendOrder[1]);

      // 2. Varied descriptions per score bracket
      let descriptionOptions = [];
      if (score === 100) {
        descriptionOptions = [
          "Soulmates! It's destiny, they belong together!",
          "An absolute match made in heaven. Zero doubts.",
          "The universe literally aligned just for them!"
        ];
      } else if (score >= 80) {
        descriptionOptions = [
          "A perfect match! Get the wedding bells ready!",
          "Incredible chemistry here. Go get 'em!",
          "They complete each other's sentences. Power couple alert!"
        ];
      } else if (score >= 60) {
        descriptionOptions = [
          "Solid chemistry. Definitely worth exploring!",
          "Cute together! There is a spark waiting to happen.",
          "Pretty good odds! Go ask them out already."
        ];
      } else if (score >= 40) {
        descriptionOptions = [
          "Just friends status. Maybe with time?",
          "A bit of a mixed bag, but there's potential.",
          "Casual vibes. Don't rush into anything!"
        ];
      } else if (score >= 20) {
        descriptionOptions = [
          "It's a struggle. They might need space.",
          "Awkward silence central. The vibe check failed.",
          "Better off as distant acquaintances, honestly."
        ];
      } else {
        descriptionOptions = [
          "sybau twin",
          "Absolute zero. Run away while you still can.",
          "Not a chance in this universe or the next."
        ];
      }

      const description = getRandomElement(descriptionOptions);

      const progressBar =
        "█".repeat(Math.floor(score / 10)) +
        "░".repeat(10 - Math.floor(score / 10));

      // 3. Build description text & inject the special 67% secret target ping
      let embedDescription = `**Match:** ${name1} x ${name2}\n**Compatibility:** ${score}%\n\n\`${progressBar}\`\n\n*${description}*`;
      
      if (score === 67) {
        embedDescription += `\n\n **67** <@1118558334308589588>`;
      }

      const embed = successEmbed(
        `💞 Ship Name: ${shipName}`,
        embedDescription,
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