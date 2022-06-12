# MYSQL
docker run --platform linux/amd64 -p 3306:3306 --name mysql -e MYSQL_ROOT_PASSWORD=1qaz2wsx! -e MYSQL_DATABASE=vision -e MYSQL_USER=vision -e MYSQL_PASSWORD=1qaz2wsx! -d mysql:5.7

# STEAMPIPE
cd ..
./steampipe/build.sh