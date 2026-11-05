<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table) {
            $table->id();

            // Datos de la prenda
            $table->string('codigo')->unique();
            $table->string('nombre');
            $table->string('categoria');
            $table->string('talle');
            $table->string('color');
            $table->decimal('precio', 10, 2);
            $table->unsignedInteger('cantidad')->default(0);

            // Nombre del archivo de imagen (ej: remera-negra.png). Puede quedar vacío
            $table->string('imagen')->nullable();

            // En qué estante está. Vacío = todavía sin ubicar
            $table->foreignId('estante_id')
                ->nullable()
                ->constrained('estantes')
                ->nullOnDelete();

            // Número de casillero dentro del estante (0, 1, 2...). Vacío = sin ubicar
            $table->unsignedSmallInteger('casillero')->nullable();

            $table->timestamps();

            // Un casillero no puede tener dos prendas a la vez.
            // (Si estante_id está vacío, MySQL no aplica la restricción)
            $table->unique(['estante_id', 'casillero']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};