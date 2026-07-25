const expressAsyncHandler = require("express-async-handler");
const mongoose = require('mongoose');
const PodcastEpisode = require("../models/PodcastEpisode");

/** Create a new podcast episode */
const createPodcastEpisode = expressAsyncHandler(
    async (req, res) => {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Episode name is required' });
        }

        try {
            const episode = await PodcastEpisode.create({
                user_id: req.userId,
                name,
                description: description || '',
                podcasts_count: 0
            });

            res.status(201).json(episode);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
);

/** Get all episodes created by the authenticated user */
const getMyPodcastEpisodes = expressAsyncHandler(
    async (req, res) => {
        try {
            const episodes = await PodcastEpisode.find({ user_id: req.userId })
                .sort({ updated_at: -1 })
                .lean()
                .exec();

            res.status(200).json(episodes);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
);

/** Get a single episode's details */
const getPodcastEpisodeById = expressAsyncHandler(
    async (req, res) => {
        const { episodeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(episodeId)) {
            return res.status(400).json({ message: 'Invalid episode id' });
        }

        try {
            const episode = await PodcastEpisode.findById(episodeId).lean().exec();

            if (!episode) {
                return res.status(404).json({ message: 'Episode not found' });
            }

            res.status(200).json(episode);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
);

/** Update an episode's name/description */
const updatePodcastEpisode = expressAsyncHandler(
    async (req, res) => {
        const { episodeId } = req.params;
        const { name, description } = req.body;

        if (!mongoose.Types.ObjectId.isValid(episodeId)) {
            return res.status(400).json({ message: 'Invalid episode id' });
        }

        if (!name && description === undefined) {
            return res.status(400).json({ message: 'Nothing to update: provide name and/or description' });
        }

        try {
            const episode = await PodcastEpisode.findById(episodeId);

            if (!episode) {
                return res.status(404).json({ message: 'Episode not found' });
            }

            if (episode.user_id.toString() !== req.userId.toString()) {
                return res.status(403).json({ message: 'You are not authorized to update this episode' });
            }

            if (name) {
                episode.name = name;
            }
            if (description !== undefined) {
                episode.description = description;
            }

            await episode.save();

            res.status(200).json(episode);
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
);

/** Delete an episode */
const deletePodcastEpisode = expressAsyncHandler(
    async (req, res) => {
        const { episodeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(episodeId)) {
            return res.status(400).json({ message: 'Invalid episode id' });
        }

        try {
            const episode = await PodcastEpisode.findById(episodeId);

            if (!episode) {
                return res.status(404).json({ message: 'Episode not found' });
            }

            if (episode.user_id.toString() !== req.userId.toString()) {
                return res.status(403).json({ message: 'You are not authorized to delete this episode' });
            }

            await PodcastEpisode.findByIdAndDelete(episodeId);

            res.status(200).json({ message: 'Episode deleted successfully' });
        } catch (err) {
            console.log(err);
            res.status(500).json({ message: err.message });
        }
    }
);

module.exports = {
    createPodcastEpisode,
    getMyPodcastEpisodes,
    getPodcastEpisodeById,
    updatePodcastEpisode,
    deletePodcastEpisode
};
