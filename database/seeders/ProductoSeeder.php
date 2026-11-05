<?php

namespace Database\Seeders;

use App\Models\Estante;
use App\Models\Producto;
use Illuminate\Database\Seeder;

class ProductoSeeder extends Seeder
{
    public function run(): void
    {
        // Crea un listado: nombre del estante => su id (ej: 'Estante A' => 1)
        $estantes = Estante::pluck('id', 'nombre');

        $productos = [
            // Estante A (casilleros 0 y 1)
            ['codigo' => 'REM-NEG-M',  'nombre' => 'Remera básica',    'categoria' => 'Remeras',    'talle' => 'M',     'color' => 'Negro',  'precio' => 12500, 'cantidad' => 25, 'imagen' => 'remera-negra.png',   'estante_id' => $estantes['Estante A'], 'casillero' => 0],
            ['codigo' => 'REM-BLA-L',  'nombre' => 'Remera básica',    'categoria' => 'Remeras',    'talle' => 'L',     'color' => 'Blanco', 'precio' => 12500, 'cantidad' => 18, 'imagen' => 'remera-blanca.png',  'estante_id' => $estantes['Estante A'], 'casillero' => 1],

            // Estante B (casilleros 0, 1 y 2)
            ['codigo' => 'JEA-AZU-40', 'nombre' => 'Jean clásico',     'categoria' => 'Pantalones', 'talle' => '40',    'color' => 'Azul',   'precio' => 38900, 'cantidad' => 12, 'imagen' => 'jean-azul.png',      'estante_id' => $estantes['Estante B'], 'casillero' => 0],
            ['codigo' => 'JEA-NEG-42', 'nombre' => 'Jean clásico',     'categoria' => 'Pantalones', 'talle' => '42',    'color' => 'Negro',  'precio' => 38900, 'cantidad' => 10, 'imagen' => 'jean-negro.png',     'estante_id' => $estantes['Estante B'], 'casillero' => 1],
            ['codigo' => 'CAM-CUA-M',  'nombre' => 'Camisa a cuadros', 'categoria' => 'Camisas',    'talle' => 'M',     'color' => 'Rojo',   'precio' => 27500, 'cantidad' => 9,  'imagen' => 'camisa-cuadros.png', 'estante_id' => $estantes['Estante B'], 'casillero' => 2],

            // Estante C (casilleros 0 y 1)
            ['codigo' => 'BUZ-GRI-L',  'nombre' => 'Buzo canguro',     'categoria' => 'Buzos',      'talle' => 'L',     'color' => 'Gris',   'precio' => 34900, 'cantidad' => 14, 'imagen' => 'buzo-gris.png',      'estante_id' => $estantes['Estante C'], 'casillero' => 0],
            ['codigo' => 'CAM-NEG-M',  'nombre' => 'Campera inflable', 'categoria' => 'Abrigos',    'talle' => 'M',     'color' => 'Negro',  'precio' => 79900, 'cantidad' => 6,  'imagen' => 'campera-negra.png',  'estante_id' => $estantes['Estante C'], 'casillero' => 1],

            // Estante D (casillero 0)
            ['codigo' => 'VES-FLO-S',  'nombre' => 'Vestido floral',   'categoria' => 'Vestidos',   'talle' => 'S',     'color' => 'Verde',  'precio' => 42000, 'cantidad' => 8,  'imagen' => 'vestido-floral.png', 'estante_id' => $estantes['Estante D'], 'casillero' => 0],

            // Sin ubicar (estante_id y casillero vacíos): sirven para probar el arrastre
            ['codigo' => 'GOR-NEG-U',  'nombre' => 'Gorra',            'categoria' => 'Accesorios', 'talle' => 'Único', 'color' => 'Negro',  'precio' => 9800,  'cantidad' => 30, 'imagen' => 'gorra-negra.png',    'estante_id' => null, 'casillero' => null],
            ['codigo' => 'MED-BLA-U',  'nombre' => 'Pack de medias',   'categoria' => 'Accesorios', 'talle' => 'Único', 'color' => 'Blanco', 'precio' => 6500,  'cantidad' => 40, 'imagen' => 'medias-blancas.png',  'estante_id' => null, 'casillero' => null],
            ['codigo' => 'BUF-GRI-U',  'nombre' => 'Bufanda',          'categoria' => 'Accesorios', 'talle' => 'Único', 'color' => 'Gris',   'precio' => 11200, 'cantidad' => 10, 'imagen' => 'bufanda-gris.png',    'estante_id' => null, 'casillero' => null],
            ['codigo' => 'SHO-AZU-M',  'nombre' => 'Short deportivo',  'categoria' => 'Shorts',     'talle' => 'M',     'color' => 'Azul',   'precio' => 15900, 'cantidad' => 20, 'imagen' => 'short-azul.png',      'estante_id' => null, 'casillero' => null],
        ];

        foreach ($productos as $producto) {
            Producto::create($producto);
        }
    }
}