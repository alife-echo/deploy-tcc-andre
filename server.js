const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const upload = multer(); // Configuração padrão do multer para upload de arquivos

const app = express();
const port = 3002;

const uri = 'mongodb+srv://andrejoas:meutcc@cluster0.taa4fgi.mongodb.net/';
const dbName = 'dadosRaio';

app.use(cors());

// Rota para exibir a página index.html
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'index.html');
  res.sendFile(indexPath);
});

// Rota para lidar com o upload de arquivos JSON
app.post('/api/upload', upload.single('jsonFile'), async (req, res) => {
  const jsonFile = req.file; // Arquivo JSON enviado pelo campo de entrada de arquivo

  if (jsonFile) {
    try {
      const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      await client.connect();

      const db = client.db(dbName);

      // Leia e analise o conteúdo do arquivo JSON
      const jsonData = JSON.parse(jsonFile.buffer.toString());

      // Consulte os dados existentes no banco de dados
      const existingData = await db.collection('dadosRaio2023').find().toArray();

      // Verifique se há informações idênticas no arquivo JSON e no banco de dados
      const duplicateData = jsonData.filter(newData => {
        return existingData.some(existingItem => {
         
          return newData.key === existingItem.key && newData.value === existingItem.value;
        });
      });

      if (duplicateData.length > 0) {
        // Dados duplicados encontrados, exiba um alerta
        res.json({ message: 'Alerta: Dados idênticos já existem no banco de dados', duplicates: duplicateData });
      } else {
        // Nenhum dado duplicado encontrado, insira-os no banco
        await db.collection('dadosRaio2023').insertMany(jsonData);

        // Atualize a lista de cache com os dados do banco de dados
        await loadDataCache();

        res.json({ message: 'Upload do arquivo JSON e inserção no banco de dados bem-sucedidos' });
      }

      client.close();
    } catch (err) {
      console.error('Erro ao fazer upload e inserir no banco de dados:', err);
      res.status(500).json({ error: 'Erro ao fazer upload e inserir no banco de dados' });
    }
  } else {
    res.status(400).json({ error: 'Nenhum arquivo JSON foi enviado' });
  }
});

// Função para carregar os dados do banco de dados na lista de cache
async function loadDataCache() {
  try {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();

    const db = client.db(dbName);
    dataCache = await db.collection('dadosRaio2023').find().toArray();

    client.close();
  } catch (err) {
    console.error('Erro ao carregar os dados do banco de dados:', err);
  }
}

// Rota para exibir a página charts.html
app.get('/graficos.html', (req, res) => {
  const chartsPath = path.join(__dirname, 'public', 'graficos.html');
  res.sendFile(chartsPath);
});

// Rota para servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

let dataCache = []; // Lista para armazenar os dados do banco de dados

// Rota para consultar os dados da coleção "dadosRaio2023"
app.get('/api', (req, res) => {
  const { month, quantity, type, time } = req.query; // Obter os filtros da query string

  let filteredData = [...dataCache]; // Criar uma cópia dos dados do cache

  // Aplicar filtros na lista de dados
  if (month) {
    filteredData = filteredData.filter(item => item.month === parseInt(month));
  }
  if (quantity) {
    filteredData = filteredData.filter(item => item.quantity === parseInt(quantity));
  }
  if (type) {
    filteredData = filteredData.filter(item => item.type === parseInt(type));
  }
  if (time) {
    filteredData = filteredData.filter(item => item.time_utc.getTime() === new Date(time).getTime());
  }

  const projection = { _id: 0, type: 1, latitude: 1, longitude: 1, time_utc: 1 };

  // Aplicar projeção nos dados filtrados
  const projectedData = filteredData.map(item => {
    const projectedItem = {};
    for (const prop in projection) {
      if (projection[prop]) {
        projectedItem[prop] = item[prop];
      }
    }
    return projectedItem;
  });

  res.json(projectedData);
});

// Rota para fornecer os dados da lista cache
app.get('/api/graficos', (req, res) => {
  res.json(dataCache);
});

// Iniciar o servidor
async function startServer() {
  await loadDataCache();
  app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}/`);
  });
}

startServer();
