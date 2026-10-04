# Logos das instituições

Seis arquivos obtidos de fontes oficiais e dois fornecidos pela usuária em
03/10/2026, mantidos em seu formato original,
sem redesenho, conversão ou alteração de cores.

## Incluídos
- itau.png: imagem enviada pela usuária (itau-seeklogo.png), origem oficial não verificada.
- viacredi.jpg: imagem JPEG enviada pela usuária (viacredlogo.jpeg), origem oficial não verificada.
- nubank.png: logo roxo, transparente, do kit de imprensa oficial.
- bradesco.png: logo horizontal vermelho, transparente, do pacote oficial.
- c6-bank.svg: logo positivo completo do pacote oficial.
- sicredi.png: versão horizontal preferencial colorida, transparente.
- inter.svg: logo principal do kit de marca oficial.
- santander.jpg: logo branco sobre fundo vermelho da sala de imprensa.

As páginas de origem, URLs de download, nomes originais e hashes SHA-256 estão
em sources.json. Os arquivos preservam as proporções e as margens dos originais.
A página do Santander indica download para uso editorial; o arquivo não
representa autorização para outros usos. Consulte as diretrizes de cada marca.

## Ainda pendentes
Não foram obtidos arquivos nesta entrega para:
- banco-do-brasil.svg
- caixa.svg
- sicoob.svg
- picpay.svg

Essas instituições continuam com o ícone genérico. Nenhuma marca foi inventada.

## Uso no app
Os caminhos estão centralizados em src/lib/finance/banks.ts.
PNG e JPG são referenciados com suas extensões reais. Não renomeie PNG para SVG.
Não há URLs externas no carregamento dos logos em tempo de execução.
Adicione os arquivos de public/banks ao commit e refaça o deploy.
Se a tela já estava aberta com um erro de imagem, recarregue a página.

Enquanto um arquivo estiver ausente ou não puder ser carregado, o componente
mantém o ícone Landmark do Lucide. Outro, códigos desconhecidos e contas sem
instituição também usam esse ícone.

## Banco de dados
Esta atualização de imagens não requer uma nova migration.
Se a migration de bankCode ainda não foi aplicada, execute npm run db:deploy
antes de publicar a funcionalidade. npm run db:generate gera o Prisma Client.
Clientes antigos podem omitir bankCode: na criação fica NULL; na edição o
valor atual é preservado. Enviar null remove a associação.
