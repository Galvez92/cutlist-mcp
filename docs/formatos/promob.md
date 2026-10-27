# Promob (listado TXT/CSV)

Clave: `promob` · Dirección: **sólo importar** · Estado: **por revisar**

## Fuentes

- «Como exportar dados do orçamento para outros softwares» (suporte Promob):
  <https://suporte.promob.com/hc/pt-br/articles/31120346591505-KB-Promob-Como-exportar-dados-do-or%C3%A7amento-para-outros-softwares>
  — la herramienta **Enviar para** ofrece e-mail, **Arquivos** (XML o TXT) y
  **Planos de Corte**.
- «Cut Pro — Configurações de Otimizadores de Corte» (suporte Promob):
  <https://suporte.promob.com/hc/pt-br/articles/31117846533905-Cut-Pro-Configura%C3%A7%C3%B5es-de-Otimizadores-de-Corte>
  — el archivo de integración es `*.csv` y el usuario configura **separador**,
  **separador decimal**, **unidad de medida**, **crear cabecera**, «solo un
  archivo», el conjunto de columnas y su orden (configuraciones por optimizador,
  con valores por defecto por plugin).
- Ejemplo real de integración de un optimizador que lee la listagem de Promob
  (XML o TXT): <https://cutplanning.tawk.help/article/promob-plus>

## Uso

Promob define las columnas y el separador: se declaran al importar.

```python
from cutlist.formats import importar

lista = importar(texto, "promob", columnas=("nombre", "cantidad", "largo", "ancho",
                                            "espesor", "material", "grupo", "veta",
                                            "canto_c1", "canto_c2", "canto_l1", "canto_l2"))
lista = importar(texto, "promob", encabezado=True, decimal=",")   # con cabecera
lista = importar(texto, "promob")                                 # orden por defecto, avisa
```

## Por revisar

- El **esquema del XML de listagem no está publicado**: el importador XML queda
  pendiente hasta contar con una muestra real (por eso el formato está «por
  revisar» y no se ofrece como verificado).
- Las columnas y su orden en el CSV de integración los define el usuario en el
  Configurador de Cut Pro; sin `columnas=` se usa un orden por defecto que la
  lista marca con aviso.
- Separador `;` y decimal coma son supuestos; en Promob son configurables.
- No está verificado que Promob importe listas de corte externas, así que no se
  implementa exportación hacia Promob (el CSV de Cut Pro lo genera Promob para
  el optimizador, no al revés).

## Pruebas

`tests/test_listados.py::TestPromob`: lectura con columnas por defecto (con
aviso), con columnas declaradas, con cabecera y separador coma, y errores.
