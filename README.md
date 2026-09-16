# ℬ Bibliotheca

O **Bibliotheca** é um sistema pessoal que estou desenvolvendo para organizar minha leitura. A ideia é ter em um único lugar a biblioteca, anotações, citações, diário de leitura, vocabulário, autores, influências e listas temáticas.

O projeto roda localmente e foi feito pensando no meu próprio fluxo de leitura, então várias partes da interface e da estrutura refletem necessidades que fui encontrando enquanto usava o sistema.

## O que dá para fazer

- Cadastrar livros e acompanhar o progresso de leitura
- Organizar livros por categorias e listas temáticas
- Fazer anotações por livro
- Guardar citações e tags
- Registrar sessões no diário de leitura
- Manter um vocabulário de termos e conceitos
- Cadastrar autores e relações de influência
- Registrar perguntas que ficaram abertas durante a leitura
- Fazer buscas pela biblioteca, anotações e vocabulário
- Manter uma wishlist de livros com histórico de preços

## Tecnologias

- Python + Flask
- MySQL/MariaDB
- HTML, CSS e JavaScript puro

O frontend é estático e conversa com o backend através de uma API Flask.

## Estrutura

```text
Bibliotheca/
├── frontend/                # Interface principal
├── backend/                 # API Flask
├── database/                # Schema do banco
├── config/                  # Arquivos de configuração de exemplo
├── wishlist/                # Módulo separado de wishlist
├── Iniciar Bibliotheca.bat  # Inicialização no Windows
└── .gitignore
```

## Rodando localmente

### Requisitos

- Python 3.10+
- MySQL 8+ ou MariaDB 10.6+
- Navegador moderno

### Backend principal

```bash
cd backend
pip install -r requirements.txt
cp ../config/.env.example .env
python setup_db.py
python app.py
```

O backend principal usa a porta `5000`.

### Wishlist

A wishlist possui seu próprio backend. As instruções ficam em [`wishlist/README.md`](wishlist/README.md).

Depois de iniciar os serviços, abra `frontend/index.html` no navegador.

No Windows, o arquivo `Iniciar Bibliotheca.bat` automatiza a inicialização, desde que o ambiente já esteja configurado.

## Segurança

O projeto foi pensado para uso local e não possui autenticação de usuários. Os arquivos `.env` não devem ser enviados ao GitHub; apenas os arquivos de exemplo com configurações seguras devem ser versionados.

Também não recomendo expor as APIs diretamente na internet sem implementar autenticação e revisar CORS, sessões e demais controles de segurança.

## Autor

**SamuelDlv**

GitHub: https://github.com/SamuelDlv

Este é um projeto pessoal que uso para juntar programação e meu estudo de livros, especialmente filosofia.
