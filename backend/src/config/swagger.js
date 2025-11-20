const swaggerJsdoc = require('swagger-jsdoc');

// ====== Swagger Configuration ======

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Collaborative Dev Platform API',
      version: '0.1.0',
      description: 'A Git-like project management system with real-time collaboration, intelligent code pattern learning, and comprehensive development workflow management.',
      contact: {
        name: 'API Support',
        url: 'https://github.com/5p00kyy/collaborative-dev-platform'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
      {
        url: 'http://localhost:8080',
        description: 'Docker development server'
      },
      {
        url: 'https://api.yourplatform.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token'
        }
      },
      schemas: {
        // ====== Common Schemas ======
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message'
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              example: 1
            },
            limit: {
              type: 'integer',
              example: 10
            },
            total: {
              type: 'integer',
              example: 100
            },
            totalPages: {
              type: 'integer',
              example: 10
            }
          }
        },
        // ====== User Schemas ======
        User: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000'
            },
            username: {
              type: 'string',
              example: 'johndoe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com'
            },
            displayName: {
              type: 'string',
              example: 'John Doe'
            },
            avatarUrl: {
              type: 'string',
              format: 'uri',
              nullable: true,
              example: 'https://example.com/avatar.jpg'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        // ====== Auth Schemas ======
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com'
            },
            password: {
              type: 'string',
              format: 'password',
              example: 'SecurePass123!'
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['username', 'email', 'password'],
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              pattern: '^[a-zA-Z0-9_-]+$',
              example: 'johndoe'
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com'
            },
            password: {
              type: 'string',
              minLength: 8,
              pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)',
              example: 'SecurePass123!'
            },
            displayName: {
              type: 'string',
              maxLength: 100,
              example: 'John Doe'
            }
          }
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Login successful'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                accessToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                },
                refreshToken: {
                  type: 'string',
                  example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                }
              }
            }
          }
        },
        // ====== Project Schemas ======
        Project: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              example: 'My Awesome Project'
            },
            description: {
              type: 'string',
              example: 'A collaborative project for building amazing things'
            },
            status: {
              type: 'string',
              enum: ['active', 'archived', 'wip'],
              example: 'active'
            },
            visibility: {
              type: 'string',
              enum: ['private', 'shared', 'public'],
              example: 'private'
            },
            ownerId: {
              type: 'string',
              format: 'uuid'
            },
            ownerUsername: {
              type: 'string',
              example: 'johndoe'
            },
            collaboratorCount: {
              type: 'integer',
              example: 5
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        CreateProjectRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              maxLength: 255,
              example: 'My New Project'
            },
            description: {
              type: 'string',
              maxLength: 5000,
              example: 'Project description here'
            },
            visibility: {
              type: 'string',
              enum: ['private', 'shared', 'public'],
              default: 'private'
            },
            status: {
              type: 'string',
              enum: ['active', 'archived', 'wip'],
              default: 'active'
            }
          }
        },
        // ====== Ticket Schemas ======
        Ticket: {
          type: 'object',
          properties: {
            ticketId: {
              type: 'string',
              format: 'uuid'
            },
            projectId: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string',
              example: 'Fix login bug'
            },
            description: {
              type: 'string',
              example: 'Users cannot login with valid credentials'
            },
            type: {
              type: 'string',
              enum: ['bug', 'feature', 'task', 'idea'],
              example: 'bug'
            },
            status: {
              type: 'string',
              enum: ['open', 'in_progress', 'review', 'closed'],
              example: 'open'
            },
            priority: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
              example: 'high'
            },
            assignedTo: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            createdBy: {
              type: 'string',
              format: 'uuid'
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              nullable: true
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['frontend', 'urgent']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        // ====== Note Schemas ======
        Note: {
          type: 'object',
          properties: {
            noteId: {
              type: 'string',
              format: 'uuid'
            },
            projectId: {
              type: 'string',
              format: 'uuid'
            },
            title: {
              type: 'string',
              example: 'Meeting Notes - Sprint Planning'
            },
            content: {
              type: 'string',
              example: '# Sprint Planning\n\n## Goals\n- Complete authentication'
            },
            path: {
              type: 'string',
              example: '/team/meetings/sprint-planning'
            },
            parentId: {
              type: 'string',
              format: 'uuid',
              nullable: true
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['meeting', 'sprint']
            },
            version: {
              type: 'integer',
              example: 1
            },
            createdBy: {
              type: 'string',
              format: 'uuid'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        // ====== Asset Schemas ======
        Asset: {
          type: 'object',
          properties: {
            assetId: {
              type: 'string',
              format: 'uuid'
            },
            name: {
              type: 'string',
              example: 'design-mockup.png'
            },
            description: {
              type: 'string',
              example: 'Homepage redesign mockup'
            },
            fileType: {
              type: 'string',
              example: 'image/png'
            },
            fileSize: {
              type: 'integer',
              example: 1024567
            },
            uploadedBy: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                displayName: { type: 'string' }
              }
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['design', 'mockup']
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Projects',
        description: 'Project management operations'
      },
      {
        name: 'Collaborators',
        description: 'Project collaborator management'
      },
      {
        name: 'Tickets',
        description: 'Ticket tracking and workflow management'
      },
      {
        name: 'Notes',
        description: 'Knowledge management and documentation'
      },
      {
        name: 'Assets',
        description: 'File and asset management'
      },
      {
        name: 'Rules',
        description: 'Code pattern rules and learning (coming soon)'
      }
    ]
  },
  apis: ['./src/routes/api/*.js', './src/routes/index.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
