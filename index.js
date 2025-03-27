import express from 'express';
import mongoose from 'mongoose';
import shortid from 'shortid';
import cors from 'cors';
import 'dotenv/config';
import validUrl from 'valid-url';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI)
  .catch(err => console.error('MongoDB Connection Error:', err));

const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  shortId: { type: String, unique: true, required: true },
  createdAt: { type: Date, default: Date.now },
  clickCount: { type: Number, default: 0 }
});
const URL = mongoose.model('URL', urlSchema);

// -------------------------------------- Shorten URL Route ---------------------------------------
app.post('/shorten', async (req, res) => {
    try {
        const { originalUrl, customName } = req.body;

        if (!originalUrl) {
          return res.status(400).json({ error: 'Original URL is required' });
        }
    
        if (!validUrl.isUri(originalUrl)) {
          return res.status(400).json({ error: 'Invalid URL format' });
        }
    
        if (customName) {
          if (!/^[a-zA-Z0-9_-]+$/.test(customName)) {
            return res.status(400).json({ error: 'Invalid custom name format' });
          }

          const existingUrl = await URL.findOne({ shortId: customName });
          if (existingUrl) {
            return res.status(400).json({ error: 'Provided name is already taken' });
          }
        }

        const shortId = customName || shortid.generate();

        const newUrl = new URL({ originalUrl, shortId });
        await newUrl.save();

        const shortUrl = `${process.env.BASEURL.replace(/\/$/, '')}/${shortId}`;

        res.status(201).json({ message: 'URL shortened successfully', shortUrl });
    } catch (error) {
        res.status(500).json({ error: 'Server error, please try again' });
    }
});

// -------------------------------------- Get All Shortened URLs (Sorted by Time) ---------------------------------
app.get('/all-urls', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const urls = await URL.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
    
    const totalDocs = await URL.countDocuments();
    const hasMore = skip + urls.length < totalDocs;

    res.status(200).json({ urls, hasMore }); // Ensure `hasMore` is part of the response
    
  } catch (error) {
    res.status(500).json({ error: 'Server error, please try again' });
  }
});


// -------------------------------------- Redirect to Original URL ---------------------------------
app.get('/:shortId', async (req, res) => {
  try {
    const { shortId } = req.params;
    const urlEntry = await URL.findOne({ shortId });

    if (!urlEntry) {
      return res.status(404).json({ error: 'Short URL not found' });
    }

    urlEntry.clickCount = (urlEntry.clickCount || 0) + 1;
    await urlEntry.save();

    res.redirect(urlEntry.originalUrl);
    
  } catch (error) {
    res.status(500).json({ error: 'Server error, please try again' });
  }
});

// -------------------------------------- Start Server ---------------------------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
