/** @type {import('@symbiote-native/engine').IViewStyle} */
export const rowStyle = { flexDirection: 'row' };
/** @type {import('@symbiote-native/engine').IViewStyle} */
export const scrollStyle = {
  width: 360,
  height: 320,
  backgroundColor: '#203040',
};
/** @type {import('@symbiote-native/engine').IViewStyle} */
export const contentStyle = { width: 360, height: 900 };
/** @type {import('@symbiote-native/engine').IViewStyle} */
export const controlsStyle = { width: 280, marginLeft: 20 };
export const refreshProps = {
  accessibilityLabel: 'Refresh library',
  tintColor: '#ffdd66',
  title: 'Pull to refresh',
  titleColor: '#99bbff',
  progressViewOffset: 8,
};

/** @param {boolean} accept @param {number} accepted @param {number} rejected @param {boolean} refreshing @param {boolean} mounted */
export function refreshStatus(accept, accepted, rejected, refreshing, mounted) {
  return `Refresh state mode=${accept ? 'accept' : 'reject'} accepted=${accepted} rejected=${rejected} refreshing=${refreshing} mounted=${mounted}`;
}
