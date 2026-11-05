<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    // up() crea la tabla
    public function up(): void
    {
        Schema::create('estantes', function (Blueprint $table) {
            $table->id();

            $table->string('nombre');

            // Dónde se dibuja el estante en el mapa 2D del almacén
            $table->integer('posicion_x')->default(0);
            $table->integer('posicion_y')->default(0);

            // Tamaño del estante en el mapa (en píxeles)
            $table->unsignedInteger('ancho')->default(220);
            $table->unsignedInteger('alto')->default(120);

            // Capacidad = cantidad de casilleros (un casillero por prenda distinta)
            $table->unsignedInteger('capacidad')->default(10);

            // Cuántos casilleros hay por fila en el estante ampliado.
            // Las filas se generan solas: capacidad 12 con 5 por fila = 3 filas
            $table->unsignedTinyInteger('por_fila')->default(5);

            $table->timestamps();
        });
    }

    // down() la elimina (se usa al deshacer migraciones)
    public function down(): void
    {
        Schema::dropIfExists('estantes');
    }
};