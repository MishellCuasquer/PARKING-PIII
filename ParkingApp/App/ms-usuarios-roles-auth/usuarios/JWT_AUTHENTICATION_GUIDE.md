# JWT Authentication and OAuth2 Implementation Guide

## Overview
This microservice (`usuarios`) now implements JWT authentication with OAuth2 for centralized authorization across all microservices in the parking system.

## Architecture

### Components Implemented

1. **JWT Configuration** (`JwtConfig.java`)
   - Token generation and validation
   - Secret key management
   - Token expiration configuration

2. **Authentication Flow**
   - Public POST endpoint: `/api/auth/login`
   - Returns JWT token with user information and roles
   - Token format: Bearer {token}

3. **Security Configuration** (`SecurityConfig.java`)
   - JWT authentication filter
   - Public endpoints for login and user management
   - Protected endpoints for authenticated requests
   - BCrypt password encoding

4. **OAuth2 Resource Server** (`OAuth2ResourceServerConfig.java`)
   - Centralized token validation
   - Role-based access control
   - Stateless session management

5. **Token Validation Endpoint**
   - Public endpoint: `/api/validate-token`
   - Other microservices can validate tokens centrally
   - Returns user information and validation status

## API Endpoints

### Public Endpoints (No Authentication Required)
- `POST /api/auth/login` - User login, returns JWT token
- `POST /api/validate-token` - Validate JWT token (for other microservices)
- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `POST /api/users/{userId}/roles/{roleId}` - Assign role to user
- `GET /api/roles` - Get all roles
- `POST /api/roles` - Create role
- `GET /api/persons` - Get all persons

### Protected Endpoints (Authentication Required)
- Any future endpoints can be protected by adding them to the security configuration

## Usage Examples

### 1. User Login (Get JWT Token)

**Request:**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "username": "jdoe",
  "password": "password123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "type": "Bearer",
  "expiresIn": 86400000,
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "username": "jdoe",
  "roles": ["ADMIN", "USER"]
}
```

### 2. Access Protected Resources

**Request:**
```bash
GET /api/protected-endpoint
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Token Validation (For Other Microservices)

**Request:**
```bash
POST /api/validate-token
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response (Valid Token):**
```json
{
  "valid": true,
  "username": "jdoe",
  "userId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response (Invalid Token):**
```json
{
  "valid": false,
  "message": "Invalid or expired token"
}
```

## Integration with Other Microservices

### For NestJS Microservices (tickets, vehiculos, zonas-espacios)

Each microservice should:

1. **Add JWT validation middleware** to validate tokens from the usuarios service
2. **Call the validation endpoint** before processing protected requests
3. **Extract user information** from the validated token

Example middleware for NestJS:

```typescript
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import axios from 'axios';

@Injectable()
export class JwtAuthMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const response = await axios.post('http://localhost:8080/api/validate-token', {}, {
        headers: { Authorization: authHeader }
      });

      if (!response.data.valid) {
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user info to request
      req['user'] = {
        username: response.data.username,
        userId: response.data.userId
      };

      next();
    } catch (error) {
      throw new UnauthorizedException('Token validation failed');
    }
  }
}
```

## Configuration

### Environment Variables

Add these to your `.env` file or environment:

```bash
# JWT Configuration
JWT_SECRET=miClaveSecretaSuperSeguraParaJWT123456789
JWT_EXPIRATION=86400000

# OAuth2 Configuration
OAUTH2_ISSUER_URI=http://localhost:8080
```

### Database

Ensure your users table has the password hash stored using BCrypt. The default password for new users is set to the DNI, but this should be changed to a secure password in production.

## Security Best Practices

1. **Change the JWT secret** in production to a strong, random key
2. **Use HTTPS** in production to protect tokens in transit
3. **Set appropriate token expiration** based on your security requirements
4. **Implement token refresh** for long-lived sessions
5. **Use environment variables** for sensitive configuration
6. **Regularly rotate secrets** in production

## Testing the Implementation

1. Start the usuarios microservice on port 8080
2. Create a user via POST /api/users
3. Login via POST /api/auth/login to get a token
4. Use the token to access protected endpoints
5. Test token validation via POST /api/validate-token

## Files Created/Modified

### New Files:
- `config/JwtConfig.java` - JWT configuration and utilities
- `config/SecurityConfig.java` - Spring Security configuration
- `config/OAuth2ResourceServerConfig.java` - OAuth2 resource server configuration
- `security/JwtAuthenticationFilter.java` - JWT authentication filter
- `security/UserDetailsServiceImpl.java` - User details service for Spring Security
- `dto/request/LoginRequest.java` - Login request DTO
- `dto/response/LoginResponse.java` - Login response DTO
- `service/AuthService.java` - Authentication service interface
- `service/impl/AuthServiceImpl.java` - Authentication service implementation
- `controller/AuthController.java` - Authentication controller
- `controller/TokenValidationController.java` - Token validation endpoint

### Modified Files:
- `pom.xml` - Added JWT, OAuth2, and Spring Security dependencies
- `repository/UserRepository.java` - Changed findByUsername to return Optional<User>
- `services/impl/UserServiceImpl.java` - Fixed username generation logic
- `application.properties` - Added JWT and OAuth2 configuration

## Next Steps

1. **Implement token refresh mechanism** for better security
2. **Add role-based access control** to specific endpoints
3. **Create user registration with password hashing**
4. **Implement password reset functionality**
5. **Add rate limiting** to prevent brute force attacks
6. **Set up CORS configuration** for cross-origin requests
7. **Add logging and monitoring** for authentication events
