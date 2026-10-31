import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  const dataDir = path.join(__dirname, 'data');
  const dataFilePath = path.join(dataDir, 'channel_store.json');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Initial stored data getter
  const getStoredData = () => {
    if (fs.existsSync(dataFilePath)) {
      try {
        return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
      } catch (e) {
        console.error('Error reading data file', e);
      }
    }
    return {
      founderPhoto: null,
      customVideos: [],
      creatorPin: '2026'
    };
  };

  const saveData = (data: any) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
  };

  // 1. Get live public channel data (seen by all visitors globally)
  app.get('/api/channel-data', (req, res) => {
    const data = getStoredData();
    res.json({
      founderPhoto: data.founderPhoto || null,
      customVideos: data.customVideos || []
    });
  });

  // 2. Verify Creator PIN
  app.post('/api/creator/verify-pin', (req, res) => {
    const { pin } = req.body;
    const data = getStoredData();
    if (pin && pin.toString() === data.creatorPin.toString()) {
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false, error: 'Galat PIN! Sirf Aryan Dangi isko change kar sakte hain.' });
  });

  // 3. Update Founder Photo (Persisted to server for everyone)
  app.post('/api/creator/update-photo', (req, res) => {
    const { pin, photo } = req.body;
    const data = getStoredData();
    if (!pin || pin.toString() !== data.creatorPin.toString()) {
      return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
    }
    data.founderPhoto = photo;
    saveData(data);
    res.json({ success: true, founderPhoto: data.founderPhoto });
  });

  // 4. Add Video (Persisted to server for everyone)
  app.post('/api/creator/add-video', (req, res) => {
    const { pin, video } = req.body;
    const data = getStoredData();
    if (!pin || pin.toString() !== data.creatorPin.toString()) {
      return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
    }
    if (!data.customVideos) data.customVideos = [];
    data.customVideos.unshift(video);
    saveData(data);
    res.json({ success: true, customVideos: data.customVideos });
  });

  // 5. Delete Video (Persisted to server)
  app.post('/api/creator/delete-video', (req, res) => {
    const { pin, videoId } = req.body;
    const data = getStoredData();
    if (!pin || pin.toString() !== data.creatorPin.toString()) {
      return res.status(401).json({ success: false, error: 'Unauthorized PIN' });
    }
    data.customVideos = (data.customVideos || []).filter((v: any) => v.id !== videoId);
    saveData(data);
    res.json({ success: true, customVideos: data.customVideos });
  });

  // 6. Change PIN
  app.post('/api/creator/change-pin', (req, res) => {
    const { currentPin, newPin } = req.body;
    const data = getStoredData();
    if (!currentPin || currentPin.toString() !== data.creatorPin.toString()) {
      return res.status(401).json({ success: false, error: 'Purana PIN galat hai' });
    }
    if (!newPin || newPin.toString().length < 4) {
      return res.status(400).json({ success: false, error: 'Naya PIN kam se kam 4 digit ka hona chahiye' });
    }
    data.creatorPin = newPin.toString();
    saveData(data);
    res.json({ success: true });
  });

  // Vite Middleware in dev / Static files in production
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(__dirname, 'dist'))) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AniDoc 2D server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
