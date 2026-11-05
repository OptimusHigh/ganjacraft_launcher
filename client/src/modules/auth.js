const https = require('https');
const http = require('http');

function authenticateYggdrasilOnce(authUrl, username, token, clientVersion = null, manifestHash = null, profileId = null, options = {}) {
    const signal = options.signal;
    return new Promise((resolve, reject) => {
        if (signal && signal.aborted) {
            return reject(new Error('CANCELLED'));
        }

        // Use Node's built-in crypto.randomUUID (available in Node 16+)
        const clientToken = require('crypto').randomUUID();

        const payload = {
            agent: { name: "Minecraft", version: 1 },
            username: username,
            password: token,
            clientToken: clientToken,
            requestUser: true
        };
        if (clientVersion) payload.clientVersion = clientVersion;
        if (manifestHash) payload.manifestHash = manifestHash;
        if (profileId) payload.profileId = profileId;

        const data = JSON.stringify(payload);

        const httpModule = authUrl.startsWith('https') ? https : http;

        const req = httpModule.request(authUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'User-Agent': 'localtunnel',
                'Bypass-Tunnel-Reminder': 'true'
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (signal && signal.aborted) {
                    return reject(new Error('CANCELLED'));
                }
                if (res.statusCode === 200) {
                    try {
                        const response = JSON.parse(body);
                        resolve({
                            accessToken: response.accessToken,
                            clientToken: response.clientToken,
                            uuid: response.selectedProfile.id,
                            name: response.selectedProfile.name
                        });
                    } catch (e) {
                        reject(new Error("Invalid JSON response from auth server"));
                    }
                } else {
                    let msg = `Auth failed (${res.statusCode})`;
                    try {
                        const parsed = JSON.parse(body);
                        if (parsed.errorMessage) {
                            msg = parsed.errorMessage;
                        } else if (parsed.detail && typeof parsed.detail === 'object' && parsed.detail.errorMessage) {
                            msg = parsed.detail.errorMessage;
                        } else if (parsed.message) {
                            msg = parsed.message;
                        }
                    } catch (e) { }
                    reject(new Error(msg));
                }
            });
        });

        const onAbort = () => {
            try { req.destroy(); } catch { }
            reject(new Error('CANCELLED'));
        };

        if (signal) {
            signal.addEventListener('abort', onAbort, { once: true });
        }

        req.setTimeout(25_000, () => {
            req.destroy(new Error('Auth request timeout (25s)'));
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function authenticateYggdrasil(authUrl, username, token, retries = 2, clientVersion = null, manifestHash = null, profileId = null, options = {}) {
    const signal = options.signal;
    const candidateUrls = Array.from(new Set([authUrl].filter(Boolean)));

    let lastError;
    for (const url of candidateUrls) {
        for (let i = 1; i <= retries; i++) {
            if (signal && signal.aborted) {
                throw new Error('CANCELLED');
            }
            try {
                return await authenticateYggdrasilOnce(url, username, token, clientVersion, manifestHash, profileId, options);
            } catch (e) {
                if (e.message === 'CANCELLED' || signal?.aborted) {
                    throw e;
                }
                lastError = e;
                if (i < retries) {
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(resolve, 1000);
                        if (signal) {
                            signal.addEventListener('abort', () => {
                                clearTimeout(timer);
                                reject(new Error('CANCELLED'));
                            }, { once: true });
                        }
                    });
                }
            }
        }
    }
    throw lastError;
}

module.exports = { authenticateYggdrasil };
