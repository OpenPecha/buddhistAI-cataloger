const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const textRouter = require('./routes/text');
const personRouter = require('./routes/person');

const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000;

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OpenPecha Text API',
      version: '1.0.0',
      description: 'API for managing OpenPecha texts',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development server',
      },
      {
        url: 'https://openpecha-text-cataloger.onrender.com',
        description: 'Production server',
      },
    ],
  },
  apis: ['./routes/*.js'], // paths to files containing OpenAPI definitions
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(cors());
app.use(express.json());

// Swagger UI
app.use('/', swaggerUi.serve);
app.get('/', swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'OpenPecha Text API Documentation'
}));

// Use routers
app.use('/text', textRouter);
app.use('/person', personRouter);

// Start the server
app.listen(port, () => {
});