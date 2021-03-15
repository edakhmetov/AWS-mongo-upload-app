require('dotenv/config');
const express = require('express');
const methodOverride = require('method-override');
const multer = require('multer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.set('view engine', 'ejs');

//MULTER setup
const storage = multer.memoryStorage();
const upload = multer({ storage }).single('file');


// create mongo connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });


// AWS S3 access
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET
});


// Create audio schema and model
const audioSchema = new mongoose.Schema({
    source: String,
    bpm: String,
    name: String,
    duration: String,
    key: String,
    type: String
});
const Audio = mongoose.model('Audio', audioSchema);


// =================ROUTES================

// Index route
app.get('/', (req, res) => {
    Audio.find({})
        .then(audios => res.render('index', { audios: audios }))
        .catch(err => console.log(err.message))
});

// add new audio file
app.get('/new', (req, res) => {
    res.render('new');
});

// upload the new audio file to AWS S3 and create a new audio object in MongoDB
app.post('/new/upload', upload, (req, res) => {

    let myFile = req.file.originalname.split('.');
    const fileType = myFile[myFile.length - 1];

    const params = {
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `${uuidv4()}.${fileType}`,
        Body: req.file.buffer
    }

    s3.upload(params, (err, data) => {
        if (err) {
            res.status(500).send(err)
        }
        // const str = req.body.tags
        const name = req.body.name,
            bpm = req.body.bpm,
            source = data.Location,
            key = data.Key,
            duration = req.body.duration,
            type = req.file.mimetype,
            // tags = str.split(" "),
            newAudio = { name, source, bpm, key, duration, type};
        Audio.create(newAudio)
            .then(() => res.redirect("/"))
            .catch(err => console.log(err.message));
    });
});

// Display a specific single audio file
app.get('/audios/:id', (req, res) => {
    Audio.findById(req.params.id).exec((err, foundAudio) => {
        if (err || !foundAudio) {
            console.log(err);
            res.redirect("/");
        } else {
            res.render("show", { audio: foundAudio });
        }
    });
});

// Edit existing audio info
app.get('/audios/:id/edit', (req, res) => {
    Audio.findById(req.params.id).exec((err, foundAudio) => {
        if (err || !foundAudio) {
            console.log(err);
            res.redirect('/');
        } else {
            res.render('edit', { audio: foundAudio });
        }
    });
});

// Update existing audio info
app.put('/audios/:id', (req, res) => {
    Audio.findByIdAndUpdate(req.params.id, req.body.audio, { useFindAndModify: false }, (err, updatedAudio) => {
        if (err || !updatedAudio) {
            console.log(err);
            res.redirect("/");
        } else {
            res.redirect('/');
        }
    });
});

// Delete a selected audio from mongoDB and S3
app.delete('/audios/:id', (req, res) => {
    Audio.findByIdAndDelete(req.params.id, (err, deletedAudio) => {
        if (err) {
            console.log(err);
            res.redirect('/');
        } else {
            const params = {
                Bucket: process.env.AWS_BUCKET_NAME,
                Key: deletedAudio.key,
            };
            s3.deleteObject(params, (err, data) => {
                if (err) {
                    console.log(err);
                } else {
                    res.redirect('/');
                }
            });
        };
    });


});

// Display all audio files in json from MongoDB
app.get('/files', (req, res) => {
    Audio.find({})
        .then(audios => res.json(audios))
        .catch(err => console.log(err.message))
});

app.listen(port, () => {
    console.log(`listening on port: ${port}`);
});