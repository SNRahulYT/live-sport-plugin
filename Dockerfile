FROM node:22-bullseye-slim

# Create app directory
WORKDIR /app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy resolver dependencies and install them
COPY resolver/package*.json ./resolver/
RUN cd resolver && npm install

# Bundle app source
COPY . .

# Hugging Face Spaces run as user 1000
RUN chown -R 1000:1000 /app
USER 1000

# Hugging Face requires the app to listen on port 7860
ENV PORT=7860
EXPOSE 7860

# Start the application
CMD [ "npm", "start" ]
