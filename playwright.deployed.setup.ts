// Waits for the deployed site to answer with HTTP 200 before the tests start, to
// absorb GitHub Pages propagation delay (spec section 7.6). The wait is bounded;
// if the limit is reached the run fails.
const ATTEMPTS = 10
const INTERVAL_MS = 15_000

export default async function globalSetup(): Promise<void> {
  const url = process.env['DEPLOYED_URL']
  if (!url) throw new Error('DEPLOYED_URL is not set (the config normalises and sets it).')

  let last = 'no response'
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url)
      if (response.status === 200) return
      last = `HTTP ${response.status}`
    } catch (error) {
      last = error instanceof Error ? error.message : String(error)
    }
    if (attempt < ATTEMPTS) {
      console.log(`Waiting for ${url} (attempt ${attempt}/${ATTEMPTS}): ${last}`)
      await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS))
    }
  }
  throw new Error(`${url} did not return HTTP 200 after ${ATTEMPTS} attempts (last: ${last}).`)
}
