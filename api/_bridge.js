// Vercel Serverless Function Bridge for VocaBoost
// Netlify/AWS Lambda uslubidagi handler(event, context) funksiyalarini
// Vercel (req, res) formatiga xatosiz moslab beradi.

export async function handleVercel(handler, req, res) {
  try {
    let body = req.body;
    if (body !== undefined && body !== null && typeof body !== 'string' && !Buffer.isBuffer(body)) {
      body = JSON.stringify(body);
    }

    const query = { ...(req.query || {}) };
    delete query.route;

    const event = {
      httpMethod: req.method,
      headers: req.headers || {},
      queryStringParameters: query,
      body: body || '',
      path: req.url,
    };

    const result = await handler(event, {});

    if (!result) {
      return res.status(200).end();
    }

    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) {
        res.setHeader(key, value);
      }
    }

    const statusCode = result.statusCode || 200;
    res.status(statusCode);

    if (result.isBase64Encoded && result.body) {
      res.send(Buffer.from(result.body, 'base64'));
    } else {
      res.send(result.body ?? '');
    }
  } catch (err) {
    console.error('Vercel API Bridge Error:', err);
    res.status(500).json({ error: err.message || 'Server xatosi' });
  }
}
