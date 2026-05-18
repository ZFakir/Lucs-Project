// loaderUtils.js

//Inject the loader HTML into the body exactly once
function injectLoader() {
  if (document.getElementById('municipal-loader-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'municipal-loader-overlay';
  overlay.innerHTML = `
    <div class="construction-zone">
      <div class="nail"></div>
      <div class="hammer"></div>
    </div>
  `;
  document.body.appendChild(overlay);
}

//Control functions
const showLoader = () => {
  injectLoader();
  document.getElementById('municipal-loader-overlay').classList.add('active');
};

const hideLoader = () => {
  const overlay = document.getElementById('municipal-loader-overlay');
  if (overlay) overlay.classList.remove('active');
};

/**
 * 3. The Wrapper Function
 * Wrap any Promise-based database call or API fetch in this function.
 * It ensures the loader plays while the work is happening, and hides even if it fails.
 */
export async function withHammerLoader(asyncTask) {
  showLoader();
  try {
    // Wait for the provided database or API call to finish
    const result = await asyncTask();
    return result;
  } catch (error) {
    console.error("Task failed while loader was active:", error);
    throw error; 
  } finally {
    // The finally block ensures the hammer stops swinging whether the DB call succeeds or errors out
    hideLoader();
  }
}