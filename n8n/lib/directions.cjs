/**
 * Validates one chronological instruction and its explicit dependencies.
 * @param step Direction to validate.
 * @param index Zero-based item position.
 * @param steps Chronological recipe directions.
 * @param cooks Number of cooks.
 */
function validateStep(step, index, steps, cooks) {
  if (step?.order !== index + 1 || !Number.isInteger(step.cook) || step.cook < 1 || step.cook > cooks) throw new Error('Invalid step order or cook.');
  if (typeof step.title !== 'string' || !step.title.trim() || typeof step.description !== 'string' || !step.description.trim()) throw new Error('Incomplete direction.');
  if (!Number.isFinite(step.startMinute) || step.startMinute < 0 || !Number.isFinite(step.durationMinutes) || step.durationMinutes <= 0) throw new Error('Invalid step timing.');
  if (index && step.startMinute < steps[index - 1].startMinute) throw new Error('Directions are not chronological.');
  if (!Array.isArray(step.dependsOn) || typeof step.parallel !== 'boolean') throw new Error('Missing step dependencies or parallel marker.');
  for (const dependency of step.dependsOn) {
    if (!Number.isInteger(dependency) || dependency < 1 || dependency >= step.order) throw new Error('Invalid step dependency.');
    const previous = steps[dependency - 1];
    if (previous.startMinute + previous.durationMinutes > step.startMinute) throw new Error('Step starts before its dependency finishes.');
  }
}



/**
 * Returns whether two scheduled directions overlap in time.
 * @param first First scheduled direction.
 * @param second Second scheduled direction.
 */
function overlaps(first, second) {
  return first.startMinute < second.startMinute + second.durationMinutes
    && second.startMinute < first.startMinute + first.durationMinutes;
}



/**
 * Checks cook availability and confirms parallel flags correspond to real parallel work.
 * @param steps Chronological recipe directions.
 * @param cooks Number of cooks.
 */
function validateParallel(steps, cooks) {
  for (const step of steps) {
    const concurrent = steps.filter(/** Checks whether the current item matches the filter. @param other Current callback input. */ (other) => other !== step && overlaps(step, other));
    if (concurrent.some(/** Checks whether this item meets the condition. @param other Current callback input. */ (other) => other.cook === step.cook)) throw new Error('One cook has overlapping tasks.');
    if (step.parallel !== (concurrent.length > 0)) throw new Error('Parallel marker does not match the schedule.');
  }
  const assigned = new Set(steps.map(/** Maps the current item to its output value. @param step Current callback input. */ (step) => step.cook));
  if (assigned.size !== cooks || cooks > 1 && !steps.some(/** Checks whether this item meets the condition. @param step Current callback input. */ (step) => step.parallel)) throw new Error('Incomplete cook task allocation.');
}



/**
 * Checks chronological order, task allocation and total cooking duration.
 * @param recipe Recipe to process.
 * @param cooks Number of cooks.
 * @param minutes Maximum cooking duration.
 */
function validateDirections(recipe, cooks, minutes) {
  const steps = recipe.directions;
  if (!Array.isArray(steps) || steps.length < cooks || steps.length > 50) throw new Error('Invalid directions.');
  steps.forEach(/** Processes the current item in the enclosing operation. @param step Current callback input. @param index Current callback input. */ (step, index) => validateStep(step, index, steps, cooks));
  validateParallel(steps, cooks);
  const finish = Math.max(...steps.map(/** Maps the current item to its output value. @param step Current callback input. */ (step) => step.startMinute + step.durationMinutes));
  if (finish > minutes) throw new Error('Directions exceed the cooking time.');
}



module.exports = { validateStep, overlaps, validateParallel, validateDirections };
