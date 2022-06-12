if [ -f ".env" ]; then
    echo ".env File exists."
else
    echo SP_PASSWORD=$(uuidgen) > .env
    echo MYSQL_ROOT_PASSWORD=$(uuidgen) >> .env
    echo MYSQL_DATABASE=vision >> .env
    echo MYSQL_USER=vision >> .env
    echo MYSQL_PASSWORD=$(uuidgen) >> .env
    echo COOKIE_PASSWORD=$(uuidgen)$(uuidgen) >> .env
    echo SP_TTL=300 >> .env
fi
# echo SP_TTL=300 >> .env

# docker build -t ms . --platform linux/amd64

docker-compose build
docker-compose up -d

# docker rmi $(docker images -f "dangling=true" -q)