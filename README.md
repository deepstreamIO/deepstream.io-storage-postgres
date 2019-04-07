# deepstream.io-storage-postgres

[![Greenkeeper badge](https://badges.greenkeeper.io/deepstreamIO/deepstream.io-storage-postgres.svg)](https://greenkeeper.io/)

Postgres Database connector for deepstream.io

This connector can be installed via the deepstream command line interface via
```
deepstream install storage postgres
```

and can be configured in the `plugins storage` section of deepstreams config.yml. Supported options are

```yaml
plugins:
  storage:
    name: postgres
    options:
      user: some-user
      database: some-database
      password: some-password
      host: localhost
      port: 5432 #postgres default post
      schema: ds #schema defaults to ds. Will be created if it doesn't exist
      table:
        defaultName: default # default table name defaults to default
        prefix: ds_ # table prefix defaults to empty string, so no prefix
      max: 10 #concurrent connections
      idleTimeoutMillis: 30000 #timeout after which connection will be cut
      writeInterval: 200 #amout of milliseconds during which writes will be
      useJsonb: false #store values as searchable binary JSON (slower)
      buffered
      notifications:
        CREATE_TABLE: false #Get notified when tables are created
        DESTROY_TABLE: false #Get notified when tables are dropped
        INSERT: false # Get notified when records are created
        UPDATE: false # Get notified when records are updated
        DELETE: false # Get notified when records are deleted
```

This connector can also be used as a standalone component from node.js to connect to postgres' notification mechanism. To do this, install the connector via

```
npm install deepstream.io-storage-postgres
```

and instantiate it directly

```javascript
const PostgresConnector = require( 'deepstream.io-storage-postgres' );
const settings = {
  user: process.env.PG_USER,
  database: process.env.PG_DB,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  port: parseInt( process.env.PG_PORT, 10 )
}

const connector = new PostgresConnector( settings )

connector.on( 'ready', ()=>{
    connector.subscribe( event =>{
        //event will be a map of event and table for CREATE_TABLE and DESTROY_TABLE
        // { event: 'CREATE_TABLE', table: 'some-table' })
        // or of event, table and key for INSERT, UPDATE AND DELETE, e.g.
        // { event: 'INSERT', table: 'some-table', key: 'some-key' }
    }, err => { if( err ) throw err; })

    //subscriptions can be removed
    connector.unsubscribe(( err )=>{ /* done */ })

    // the connector also comes with a facility to get a map of all tables and the numbers of items within
    connector.getSchemaOverview(( err, result ) => {
        /* result will be e.g.
        {
            'some-table': 2,
            'some-other-table': 1,
            'new-table': 1,
            'table-a': 2,
            'table-b': 2
        }
        */
    })
})
```
