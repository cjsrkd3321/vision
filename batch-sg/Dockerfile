FROM node
LABEL email="7424069@gmail.com"
LABEL name="cjsrkd3321"

USER root

# dockerize
RUN apt-get update && apt-get install -y wget
ENV DOCKERIZE_VERSION v0.6.1
RUN wget https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && tar -C /usr/local/bin -xzvf dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz \
    && rm dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz

USER node
WORKDIR /usr/src/app

COPY --chown=node:node . ./

RUN npm install
RUN npm run build

RUN chmod +x entrypoint.sh

COPY credentials /home/node/.aws/credentials
COPY config /home/node/.aws/config

ENTRYPOINT ["./entrypoint.sh"]