# Stage 1: Build the React Application
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Accept an API URL during the build process
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

ARG VITE_NEWSFEED_API_URL
ENV VITE_NEWSFEED_API_URL=$VITE_NEWSFEED_API_URL

ARG VITE_STATUS_API_URL
ENV VITE_STATUS_API_URL=$VITE_STATUS_API_URL

ARG VITE_REELS_API_URL
ENV VITE_REELS_API_URL=$VITE_REELS_API_URL

# Build the Vite project
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the built assets from the builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start Nginx server
CMD ["nginx", "-g", "daemon off;"]
