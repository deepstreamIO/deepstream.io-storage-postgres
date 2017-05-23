console.time( 'start' );
var start = process.hrtime();

setTimeout(function(){
	var diff = process.hrtime( start ) ;
	var nano = diff[0] * 1e9 + diff[1];
	console.log( nano / 1000000 );
	//console.log( `Benchmark took ${sec} seconds` );
	console.timeEnd( 'start' );
}, 200 );

