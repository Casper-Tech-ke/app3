const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Utility function to convert milliseconds to minutes:seconds format
async function convert(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

// Main Spotify function
async function spotify(query) {
  return new Promise(async (resolve, reject) => {
    try {
      // First get Spotify credentials
      const creds = await axios.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
        headers: {
          Authorization: 'Basic ' + Buffer.from('4c4fc8c3496243cbba99b39826e2841f' + ':' + 'd598f89aba0946e2b85fb8aefa9ae4c8').toString('base64')
        }
      });
      
      if (!creds.data.access_token) {
        return reject(new Error('Failed to get Spotify access token'));
      }
      
      // Get track info
      const trackInfo = await axios.get(query, {
        headers: {
          Authorization: 'Bearer ' + creds.data.access_token
        }
      });
      const track = trackInfo.data;
      if (!track) {
        return reject(new Error('Track not found'));
      }
      
      // Download the track
      const BASEURL = "https://api.fabdl.com";
      const headers = {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
      };
      const { data: info } = await axios.get(`${BASEURL}/spotify/get?url=${query}`, { headers });
      const { gid, id } = info.result;
      const { data: download } = await axios.get(`${BASEURL}/spotify/mp3-convert-task/${gid}/${id}`, { headers });
      
      if (!download.result.download_url) {
        return reject(new Error('Failed to get download URL'));
      }
      
      const downloadUrl = `${BASEURL}${download.result.download_url}`;
      
      // Prepare metadata
      const result = {
        title: track.artists[0]?.name + ' - ' + track.name,
        artist: track.artists[0]?.name,
        name: track.name,
        duration: await convert(track.duration_ms),
        popularity: track.popularity + '%',
        preview: track.preview_url || 'No preview audio Available',
        thumbnail: track.album.images[0]?.url,
        url: track.external_urls.spotify,
        downloadLink: downloadUrl,
      };
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// API Routes
app.get('/api/spotify', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL parameter is required' 
      });
    }
    
    // Validate if it's a Spotify URL
    if (!url.includes('open.spotify.com')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide a valid Spotify URL' 
      });
    }
    
    const result = await spotify(url);
    res.json({ success: true, data: result });
    
  } catch (error) {
    console.error('Spotify API Error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve the explore page
app.get('/explore', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/explore.html'));
});

// Serve the test page
app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/test.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
