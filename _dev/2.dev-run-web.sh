cd ../web
npm i
npx prisma generate
npx prisma db push
npm run dev