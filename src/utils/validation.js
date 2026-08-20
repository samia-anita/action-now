'use strict';

const VALID_ISSUES = [
  'climate & environment',
  'food insecurity',
  'housing & homelessness',
  'mental health',
  'gender-based violence',
  'social justice',
  'education access',
  'animal welfare'
];

const VALID_SKILLS = [
  'I can drive',
  'I can write or design',
  'I speak another language',
  'I can code',
  'I can cook or bake',
  'I can do physical labour',
  'I can listen and support people',
  'I have no specific skills but I want to help'
];

const VALID_TIMES = [
  '15 minutes',
  'about 1 hour',
  'a few hours this weekend',
  'ongoing commitment'
];

/**
 * Validates the incoming action request body.
 * @param {unknown} body
 * @returns {{ success: true, data: object } | { success: false, error: string }}
 */
function validateActionRequest(body) {
  if (!body || typeof body !== 'object') {
    return { success: false, error: 'Request body must be a JSON object' };
  }

  const errors = [];
  const { location, issue, time, skills } = body;

  // location
  if (location === undefined || location === null) {
    errors.push('location is required');
  } else if (typeof location !== 'string' || location.trim().length < 2) {
    errors.push('location must be at least 2 characters');
  } else if (location.trim().length > 120) {
    errors.push('location must be under 120 characters');
  }

  // issue
  if (!issue) {
    errors.push('issue is required');
  } else if (!VALID_ISSUES.includes(issue)) {
    errors.push(`issue must be one of: ${VALID_ISSUES.join(', ')}`);
  }

  // time
  if (!time) {
    errors.push('time is required');
  } else if (!VALID_TIMES.includes(time)) {
    errors.push(`time must be one of: ${VALID_TIMES.join(', ')}`);
  }

  // skills (optional)
  if (skills !== undefined && skills !== null) {
    if (!Array.isArray(skills)) {
      errors.push('skills must be an array');
    } else if (skills.length > 8) {
      errors.push('too many skills selected');
    } else {
      const invalidSkills = skills.filter(s => !VALID_SKILLS.includes(s));
      if (invalidSkills.length > 0) {
        errors.push(`invalid skills: ${invalidSkills.join(', ')}`);
      }
    }
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join('; ') };
  }

  return {
    success: true,
    data: {
      location: location.trim(),
      issue,
      time,
      skills: Array.isArray(skills) ? skills.filter(Boolean) : []
    }
  };
}

/**
 * Validates a URL string (basic structural check).
 * @param {unknown} url
 * @returns {boolean}
 */
function isValidHttpUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = {
  validateActionRequest,
  isValidHttpUrl,
  VALID_ISSUES,
  VALID_SKILLS,
  VALID_TIMES
};
