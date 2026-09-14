/** Applies only a trusted server-side, approved portion policy; never reads policy flags from input.
 * @param context Validated request context before quota access.
 * @param policy Internal policy dependency; null until the owner approves a concrete rule.
 */
function quantityGate(context, policy = null) {
  const result = { ...context, quantityRejected: false, quantityAssessment: 'not_assessed' };
  if (!policy || policy.approved !== true) return result;
  if (typeof policy.id !== 'string' || !policy.id || typeof policy.assess !== 'function') throw new Error('Invalid quantity policy.');
  const assessment = policy.assess(context.request);
  if (!['sufficient', 'insufficient', 'not_assessed'].includes(assessment)) throw new Error('Invalid quantity assessment.');
  return { ...result, quantityAssessment: assessment, quantityRejected: assessment === 'insufficient', quantityPolicyId: policy.id };
}



module.exports = { quantityGate };
