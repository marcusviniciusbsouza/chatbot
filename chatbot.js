const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const client = new Client();

const userStates = new Map();
const userData = new Map();

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Tudo certo! WhatsApp conectado.');
});

client.initialize();

const delay = ms => new Promise(res => setTimeout(res, ms));

client.on('message', async msg => {
    const chat = await msg.getChat();
    const sender = msg.from;
    const contact = await msg.getContact();
    const senderName = contact.pushname || sender.replace('@c.us', '');

    // Caminho base para armazenar os dados do usuário
    const userFolder = path.join(__dirname, 'uploads', senderName);

    // Criar a pasta do usuário se ainda não existir
    if (!fs.existsSync(userFolder)) {
        fs.mkdirSync(userFolder, { recursive: true });
    }

    // Se o usuário começar a interação
    if (msg.body.match(/(tarde|dia|noite|oi|olá|ola|menu|atendimento)/i) && sender.endsWith('@c.us')) {
        await delay(3000); // Delay para evitar bloqueio
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, `Olá, ${senderName.split(" ")[0]}! Sou o assistente virtual do cartório ZAWuso. Como posso ajudá-lo hoje?`);

        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, `\n\n1️⃣ - Serviços disponíveis \n2️⃣ - Horários de atendimento \n3️⃣ - Cadastro`);
    }

    // Serviços disponíveis
    if (msg.body === '1') {
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, 'Temos os seguintes registros:\n1️⃣ - Registro de nascimento\n2️⃣ - Registro de casamento\n3️⃣ - Registro de óbito');

        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, '🔄 Digite *menu* para voltar ao menu ou ❌ Digite *sair* para finalizar o atendimento.');
    }

    // Horários de atendimento
    if (msg.body === '2') {
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, 'Os horários disponíveis são das 9:30 até as 12 e das 13:10 até as 18.');

        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, '🔄 Digite *menu* para voltar ao menu ou ❌ Digite *sair* para finalizar o atendimento.');
    }

    // Processo de Cadastro
    if (msg.body === '3') {
        userStates.set(sender, "solicitando_nome");
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, "📋 Para o cadastro, por favor, envie seu **nome completo**.");
        return;
    }

    // Captura Nome Completo
    if (userStates.get(sender) === "solicitando_nome") {
        userData.set(sender, { nome: msg.body });
        userStates.set(sender, "solicitando_cpf");

        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, "✅ Nome recebido!\nAgora, por favor, envie seu **CPF**.");
        return;
    }

    // Captura CPF
    if (userStates.get(sender) === "solicitando_cpf") {
        const data = userData.get(sender) || {};
        data.cpf = msg.body;
        userData.set(sender, data);
        userStates.set(sender, "solicitando_rg");

        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, "✅ CPF recebido!\nAgora, por favor, envie uma **foto do seu RG**.");
        return;
    }

    // Captura RG (Somente se o usuário estiver nessa etapa)
    if (userStates.get(sender) === "solicitando_rg" && msg.hasMedia) {
        const media = await msg.downloadMedia();
        const extension = media.mimetype.split('/')[1];
        const filePath = path.join(userFolder, `RG.${extension}`);

        fs.writeFile(filePath, media.data, 'base64', err => {
            if (err) {
                console.error('Erro ao salvar RG:', err);
                client.sendMessage(sender, '❌ Erro ao salvar o RG. Tente novamente.');
            } else {
                console.log(`RG salvo em: ${filePath}`);
                client.sendMessage(sender, "✅ RG recebido!\nAgora, por favor, envie suas **certidões** (nascimento, casamento ou óbito).");
                userStates.set(sender, "solicitando_certidoes");
            }
        });
        return;
    }

    // Captura Certidões
    if (userStates.get(sender) === "solicitando_certidoes" && msg.hasMedia) {
        const media = await msg.downloadMedia();
        const extension = media.mimetype.split('/')[1];
        const filePath = path.join(userFolder, `Certidao.${extension}`);

        fs.writeFile(filePath, media.data, 'base64', err => {
            if (err) {
                console.error('Erro ao salvar Certidão:', err);
                client.sendMessage(sender, '❌ Erro ao salvar a Certidão. Tente novamente.');
            } else {
                console.log(`Certidão salva em: ${filePath}`);
                client.sendMessage(sender, "✅ Certidão recebida!\nUm **atendente humano** entrará em contato para validar seus documentos. Aguarde...");
                userStates.set(sender, "atendimento_humano");
            }
        });
        return;
    }

    // Finalização do Atendimento pelo atendente
    if (userStates.get(sender) === "atendimento_humano" && msg.body.toLowerCase() === 'finalizar atendimento') {
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, '✅ Atendimento finalizado pelo atendente. Você pode continuar o processo de cadastro a qualquer momento.');
        userStates.set(sender, "reentrando_no_bot");
        await delay(3000);
        await client.sendMessage(sender, '🔄 Você retornou ao bot. Para continuar, digite *menu* para acessar as opções.');
    }

    // Opção para sair do atendimento (não deixa o cliente finalizar o atendimento)
    if (msg.body.toLowerCase() === 'sair' && userStates.get(sender) !== 'atendimento_humano') {
        await delay(3000);
        await chat.sendStateTyping();
        await delay(3000);
        await client.sendMessage(sender, '✅ Atendimento finalizado. Caso precise de algo no futuro, estamos à disposição. Tenha um ótimo dia! 😊');
        userStates.delete(sender);
        userData.delete(sender);
    }
});
