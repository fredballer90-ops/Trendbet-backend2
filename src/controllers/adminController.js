// backend/src/controllers/adminController.js
const Event = require('../models/Event');
const EventOption = require('../models/EventOption');

export const createEvent = async (req, res) => {
  try {
    const { 
      title, 
      description, 
      category, 
      startTime, 
      endTime, 
      options 
    } = req.body;

    // Validate options
    if (!options || options.length < 2) {
      return res.status(400).json({ 
        error: 'At least 2 options required' 
      });
    }

    // Calculate initial probabilities and odds
    const totalProbability = options.reduce((sum, opt) => sum + opt.probability, 0);
    const margin = 0.05; // 5% house edge

    const event = await Event.create({
      title,
      description,
      category,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      createdBy: req.userId
    });

    // Create event options with calculated odds
    const eventOptions = await Promise.all(
      options.map(async (option) => {
        const inflatedProbability = option.probability / totalProbability * (1 + margin);
        const odds = 1 / inflatedProbability;

        return await EventOption.create({
          eventId: event._id,
          name: option.name,
          currentOdds: parseFloat(odds.toFixed(2)),
          initialOdds: parseFloat(odds.toFixed(2)),
          probability: option.probability
        });
      })
    );

    res.status(201).json({
      message: 'Event created successfully',
      event: {
        ...event.toObject(),
        options: eventOptions
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getEvents = async (req, res) => {
  try {
    const { category, status, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    if (category) filter.category = category;
    if (status) filter.status = status;

    const events = await Event.find(filter)
      .populate('options')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Event.countDocuments(filter);

    res.json({
      events,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
