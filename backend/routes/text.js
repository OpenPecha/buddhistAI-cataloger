const express = require("express");
const axios = require("axios");
const router = express.Router();
require("dotenv").config();

const API_ENDPOINT = process.env.OPENPECHA_ENDPOINT;

/**
 * @swagger
 * components:
 *   schemas:
 *     Text:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier for the text
 *           example: "EXP_0001"
 *         type:
 *           type: string
 *           enum: [root, translation, commentary]
 *           description: Type of the text
 *           example: "root"
 *         title:
 *           type: object
 *           description: Localized titles
 *           additionalProperties:
 *             type: string
 *           example:
 *             bo: "རྩ་བའི་གཞུང་།"
 *             en: "Root Text"
 *         language:
 *           type: string
 *           description: Primary language code
 *           example: "bo"
 *         parent:
 *           type: string
 *           nullable: true
 *           description: Parent text ID (for translations/commentaries)
 *           example: "EXP_0001"
 *         contributions:
 *           type: array
 *           description: List of contributors
 *           items:
 *             oneOf:
 *               - type: object
 *                 properties:
 *                   person_id:
 *                     type: string
 *                     example: "P12345678"
 *                   role:
 *                     type: string
 *                     enum: [author, translator, reviser, scholar]
 *                     example: "author"
 *               - type: object
 *                 properties:
 *                   ai_id:
 *                     type: string
 *                     example: "gpt-4"
 *                   role:
 *                     type: string
 *                     enum: [author, translator, reviser, scholar]
 *                     example: "translator"
 *         date:
 *           type: string
 *           nullable: true
 *           description: Date associated with the text
 *           example: "2024-01-15"
 *         bdrc:
 *           type: string
 *           nullable: true
 *           description: BDRC reference
 *           example: "W1234"
 *         wiki:
 *           type: string
 *           nullable: true
 *           description: Wikipedia or wiki reference URL
 *           example: "https://en.wikipedia.org/wiki/Example"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the text was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the text was last updated
 */

/**
 * @swagger
 * /text:
 *   get:
 *     summary: Get texts from OpenPecha API
 *     description: Retrieves a list of texts with optional filtering by language and author
 *     tags: [Texts]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Maximum number of texts to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of texts to skip
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter texts by language code (e.g., 'bo' for Tibetan)
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Filter texts by author ID
 *     responses:
 *       200:
 *         description: Successfully retrieved texts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "EXP_0001"
 *                       type:
 *                         type: string
 *                         enum: [root, translation, commentary]
 *                       title:
 *                         type: object
 *                         additionalProperties:
 *                           type: string
 *                       language:
 *                         type: string
 *                       parent:
 *                         type: string
 *                         nullable: true
 *                       contributions:
 *                         type: array
 *                       date:
 *                         type: string
 *                         nullable: true
 *                       bdrc:
 *                         type: string
 *                         nullable: true
 *                       wiki:
 *                         type: string
 *                         nullable: true
 *                 count:
 *                   type: integer
 *                   description: Total number of texts
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.get("/", async (req, res) => {
  try {
    const { limit = 30, offset = 0, language, author } = req.query;

    // Build query parameters for OpenPecha API
    const queryParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    if (language) queryParams.append("language", language);
    if (author) queryParams.append("author", author);

    const apiUrl = `${API_ENDPOINT}/texts?${queryParams.toString()}`;
    const response = await axios.get(apiUrl, {
      headers: {
        accept: "application/json",
      },
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch texts from OpenPecha API",
      details: error.message,
    });
  }
});

/**
 * @swagger
 * /text:
 *   post:
 *     summary: Create a new text
 *     description: Creates a new text record in the OpenPecha API
 *     tags: [Texts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - language
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [root, translation, commentary]
 *                 description: Type of text
 *               title:
 *                 type: object
 *                 description: Title in multiple languages
 *                 properties:
 *                   en:
 *                     type: string
 *                     description: English title
 *                   bo:
 *                     type: string
 *                     description: Tibetan title
 *               language:
 *                 type: string
 *                 description: Primary language code
 *                 example: bo
 *               contributions:
 *                 type: array
 *                 description: List of contributors
 *                 items:
 *                   type: object
 *                   properties:
 *                     person_id:
 *                       type: string
 *                       description: Person ID
 *                     role:
 *                       type: string
 *                       enum: [author, translator, reviser, editor]
 *                       description: Role of the contributor
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Date of creation
 *                 example: "2024-01-01"
 *               bdrc:
 *                 type: string
 *                 description: BDRC identifier
 *               alt_titles:
 *                 type: array
 *                 description: Alternative titles
 *                 items:
 *                   type: object
 *                   properties:
 *                     en:
 *                       type: string
 *                     bo:
 *                       type: string
 *           examples:
 *             root_text:
 *               summary: Root text creation
 *               value:
 *                 type: "root"
 *                 title:
 *                   en: "Sample Root Text"
 *                   bo: "བོད་ཡིག་དཔེ་མཚོན།"
 *                 language: "bo"
 *                 contributions:
 *                   - person_id: "P12345678"
 *                     role: "author"
 *                 date: "2024-01-01"
 *                 bdrc: "W123456"
 *     responses:
 *       201:
 *         description: Text created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Text'
 *       400:
 *         description: Bad request - invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", async (req, res) => {
  try {
    const textData = req.body;

    // Validate required fields
    if (!textData.type || !textData.title || !textData.language) {
      return res.status(400).json({
        error: "Missing required fields",
        details: "type, title, and language are required",
      });
    }

    // Validate text type
    const validTypes = ["root", "translation", "commentary"];
    if (!validTypes.includes(textData.type)) {
      return res.status(400).json({
        error: "Invalid text type",
        details: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    // Validate contributions if provided
    if (textData.contributions) {
      const validRoles = ["author", "translator", "reviser", "editor"];
      for (const contribution of textData.contributions) {
        if (!contribution.person_id || !contribution.role) {
          return res.status(400).json({
            error: "Invalid contribution",
            details: "Each contribution must have person_id and role",
          });
        }
        if (!validRoles.includes(contribution.role)) {
          return res.status(400).json({
            error: "Invalid contribution role",
            details: `role must be one of: ${validRoles.join(", ")}`,
          });
        }
      }
    }

    const apiUrl = `${API_ENDPOINT}/texts`;

    const response = await axios.post(apiUrl, textData, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    });

    res.status(201).json(response.data);
  } catch (error) {
    if (error.response) {
      // Forward the error response from OpenPecha API
      res.status(error.response.status).json({
        error: "Failed to create text in OpenPecha API",
        details: error.response.data || error.message,
      });
    } else {
      res.status(500).json({
        error: "Failed to create text",
        details: error.message,
      });
    }
  }
});

/**
 * @swagger
 * /text/{id}:
 *   get:
 *     summary: Get a specific text by ID
 *     description: Retrieves detailed information about a specific text from the OpenPecha API
 *     tags:
 *       - Texts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the text
 *         example: "EXP_0001"
 *     responses:
 *       200:
 *         description: Text retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "EXP_0001"
 *                 type:
 *                   type: string
 *                   enum: [root, translation, commentary]
 *                   example: "root"
 *                 title:
 *                   type: object
 *                   description: Localized titles
 *                   additionalProperties:
 *                     type: string
 *                   example:
 *                     bo: "རྩ་བའི་གཞུང་།"
 *                     en: "Root Text"
 *                 language:
 *                   type: string
 *                   example: "bo"
 *                 parent:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 contributions:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - type: object
 *                         properties:
 *                           person_id:
 *                             type: string
 *                             example: "P12345678"
 *                           role:
 *                             type: string
 *                             example: "author"
 *                       - type: object
 *                         properties:
 *                           ai_id:
 *                             type: string
 *                             example: "gpt-4"
 *                           role:
 *                             type: string
 *                             example: "translator"
 *                 date:
 *                   type: string
 *                   nullable: true
 *                   example: "2024-01-15"
 *                 bdrc:
 *                   type: string
 *                   nullable: true
 *                   example: "W1234"
 *                 wiki:
 *                   type: string
 *                   nullable: true
 *                   example: "https://en.wikipedia.org/wiki/Example"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *       404:
 *         description: Text not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Text not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve text"
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const apiUrl = `${API_ENDPOINT}/texts/${id}`;
  const response = await axios.get(apiUrl, {
    headers: {
      accept: "application/json",
    },
  });
  res.json(response.data);
});

/**
 * @swagger
 * /text/{id}/instances:
 *   get:
 *     summary: Get all instances of a specific text
 *     description: Retrieves a list of all instances associated with a specific text from the OpenPecha API
 *     tags:
 *       - Instances
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the text
 *         example: "EXP_0001"
 *     responses:
 *       200:
 *         description: List of instances retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Unique identifier for the instance
 *                     example: "INST_0001"
 *                   text_id:
 *                     type: string
 *                     description: ID of the associated text
 *                     example: "EXP_0001"
 *                   title:
 *                     type: object
 *                     description: Localized titles
 *                     additionalProperties:
 *                       type: string
 *                     example:
 *                       bo: "དཔེ་ཆ་མཚན།"
 *                       en: "Instance Title"
 *                   language:
 *                     type: string
 *                     description: Language code
 *                     example: "bo"
 *                   format:
 *                     type: string
 *                     description: Format of the instance
 *                     example: "digital"
 *                   source:
 *                     type: string
 *                     description: Source of the instance
 *                     example: "BDRC"
 *                   volume:
 *                     type: string
 *                     description: Volume information
 *                     example: "Vol. 1"
 *                   location:
 *                     type: object
 *                     description: Location information
 *                     properties:
 *                       start:
 *                         type: string
 *                         example: "1a"
 *                       end:
 *                         type: string
 *                         example: "10b"
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *       404:
 *         description: Text not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Text not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve instances"
 */
router.get("/:id/instances", async (req, res) => {
  const { id } = req.params;
  const apiUrl = `${API_ENDPOINT}/texts/${id}/instances`;

  const response = await axios.get(apiUrl, {
    headers: {
      accept: "application/json",
    },
  });
  res.json(response.data);
});

/**
 * @swagger
 * /text/{id}/instances:
 *   post:
 *     summary: Create a new text instance
 *     description: Creates a new instance for a specific text in the OpenPecha API. Supports both diplomatic and critical instances, with or without annotations.
 *     tags: [Instances]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The text ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - metadata
 *               - content
 *             properties:
 *               metadata:
 *                 type: object
 *                 required:
 *                   - type
 *                   - copyright
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [diplomatic, critical]
 *                     description: Instance type (diplomatic or critical)
 *                   copyright:
 *                     type: string
 *                     description: Copyright information
 *                   bdrc:
 *                     type: string
 *                     description: BDRC identifier (typically used for diplomatic instances)
 *                   colophon:
 *                     type: string
 *                     description: Colophon text
 *                   incipit_title:
 *                     type: object
 *                     properties:
 *                       en:
 *                         type: string
 *                         description: English incipit title
 *                       bo:
 *                         type: string
 *                         description: Tibetan incipit title
 *               annotation:
 *                 type: array
 *                 description: Annotation data (optional). For diplomatic instances, include reference URLs.
 *                 items:
 *                   type: object
 *                   required:
 *                     - span
 *                   properties:
 *                     span:
 *                       type: object
 *                       required:
 *                         - start
 *                         - end
 *                       properties:
 *                         start:
 *                           type: integer
 *                           description: Start position of the annotation
 *                         end:
 *                           type: integer
 *                           description: End position of the annotation
 *                     reference:
 *                       type: string
 *                       description: Reference URL (typically used for diplomatic instances to link to source images)
 *               content:
 *                 type: string
 *                 description: The text content
 *           examples:
 *             diplomaticWithAnnotation:
 *               summary: Valid diplomatic instance creation with annotation
 *               value:
 *                 metadata:
 *                   type: "diplomatic"
 *                   copyright: "public"
 *                   bdrc: "W123456"
 *                   colophon: "Sample colophon text"
 *                   incipit_title:
 *                     en: "Opening words"
 *                     bo: "དབུ་ཚིག"
 *                 annotation:
 *                   - span:
 *                       start: 0
 *                       end: 10
 *                     reference: "https://example.com/image1.png"
 *                   - span:
 *                       start: 11
 *                       end: 20
 *                     reference: "https://example.com/image2.png"
 *                 content: "This is the text content to be stored"
 *             criticalWithAnnotation:
 *               summary: Valid critical instance creation with annotation
 *               value:
 *                 metadata:
 *                   type: "critical"
 *                   copyright: "public"
 *                   colophon: "Sample colophon text"
 *                   incipit_title:
 *                     en: "Opening words"
 *                     bo: "དབུ་ཚིག"
 *                 annotation:
 *                   - span:
 *                       start: 0
 *                       end: 10
 *                   - span:
 *                       start: 10
 *                       end: 20
 *                 content: "This is the text content to be stored"
 *             criticalWithoutAnnotation:
 *               summary: Valid critical instance creation without annotation
 *               value:
 *                 metadata:
 *                   type: "critical"
 *                   copyright: "public"
 *                   colophon: "Sample colophon text"
 *                   incipit_title:
 *                     en: "Opening words"
 *                     bo: "དབུ་ཚིག"
 *                 content: "This is the text content to be stored"
 *             diplomaticWithoutAnnotation:
 *               summary: Valid diplomatic instance creation without annotation
 *               value:
 *                 metadata:
 *                   type: "diplomatic"
 *                   copyright: "public"
 *                   bdrc: "W123456"
 *                   colophon: "Sample colophon text"
 *                   incipit_title:
 *                     en: "Opening words"
 *                     bo: "དབུ་ཚིག"
 *                 content: "This is the text content to be stored"
 *     responses:
 *       201:
 *         description: Text instance created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: Created instance data
 *       400:
 *         description: Bad request - invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/:id/instances", async (req, res) => {
  try {
    const { id } = req.params;
    const instanceData = req.body;

    // Validate required fields
    if (!instanceData.content) {
      return res.status(400).json({
        error: "Missing required field",
        details: "content is required",
      });
    }

    const apiUrl = `${API_ENDPOINT}/texts/${id}/instances`;

    const response = await axios.post(apiUrl, instanceData, {
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
    });

    res.status(201).json(response.data);
  } catch (error) {
    if (error.response) {
      // Forward the error response from OpenPecha API
      res.status(error.response.status).json({
        error: "Failed to create text instance in OpenPecha API",
        details: error.response.data || error.message,
      });
    } else {
      res.status(500).json({
        error: "Failed to create text instance",
        details: error.message,
      });
    }
  }
});

/**
 * @swagger
 * /text/instances/{instanceId}:
 *   get:
 *     summary: Get a specific text instance by ID
 *     description: Retrieves detailed information about a specific text instance from the OpenPecha API
 *     tags:
 *       - Instances
 *     parameters:
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique identifier of the text instance
 *         example: "tZ0gbaPaArzU71mB"
 *     responses:
 *       200:
 *         description: Text instance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Unique identifier for the instance
 *                   example: "INST_0001"
 *                 text_id:
 *                   type: string
 *                   description: ID of the associated text
 *                   example: "EXP_0001"
 *                 title:
 *                   type: object
 *                   description: Localized titles
 *                   additionalProperties:
 *                     type: string
 *                   example:
 *                     bo: "དཔེ་ཆ་མཚན།"
 *                     en: "Instance Title"
 *                 language:
 *                   type: string
 *                   description: Language code
 *                   example: "bo"
 *                 format:
 *                   type: string
 *                   description: Format of the instance
 *                   example: "digital"
 *                 source:
 *                   type: string
 *                   description: Source of the instance
 *                   example: "BDRC"
 *                 volume:
 *                   type: string
 *                   description: Volume information
 *                   example: "Vol. 1"
 *                 location:
 *                   type: object
 *                   description: Location information
 *                   properties:
 *                     start:
 *                       type: string
 *                       example: "1a"
 *                     end:
 *                       type: string
 *                       example: "10b"
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when the instance was created
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp when the instance was last updated
 *       404:
 *         description: Instance not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Instance not found"
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to retrieve instance"
 */
router.get("/instances/:instanceId", async (req, res) => {
  const { instanceId } = req.params;
  const apiUrl = `${API_ENDPOINT}/instances/${instanceId}`;
  const response = await axios.get(apiUrl, {
    headers: {
      accept: "application/json",
    },
  });
  res.json(response.data);
});

module.exports = router;
