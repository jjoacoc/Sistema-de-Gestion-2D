<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Producto extends Model
{
    // Lista fija de categorías: la usan la validación y el selector del formulario
    public const CATEGORIAS = [
        'Remeras',
        'Pantalones',
        'Camisas',
        'Buzos',
        'Abrigos',
        'Vestidos',
        'Shorts',
        'Accesorios',
    ];

    protected $fillable = [
        'codigo',
        'nombre',
        'categoria',
        'talle',
        'color',
        'precio',
        'cantidad',
        'imagen',
        'estante_id',
        'casillero',
    ];

    // Convierte el precio a número decimal al leerlo de la base
    protected function casts(): array
    {
        return [
            'precio' => 'decimal:2',
        ];
    }

    // Un producto pertenece a un estante (o a ninguno)
    public function estante(): BelongsTo
    {
        return $this->belongsTo(Estante::class);
    }

    // Arma un código a partir de nombre, color y talle.
    // Ejemplo: "Remera básica" + "Negro" + "M" = REM-NEG-M
    // Si ese código ya existe, agrega -2, -3... hasta encontrar uno libre.
    public static function generarCodigo(string $nombre, string $color, string $talle): string
    {
        $base = self::abreviar($nombre, 3) . '-' . self::abreviar($color, 3) . '-' . self::abreviar($talle);

        $codigo = $base;
        $numero = 2;

        while (self::where('codigo', $codigo)->exists()) {
            $codigo = $base . '-' . $numero;
            $numero++;
        }

        return $codigo;
    }

    // Deja solo letras y números, sin tildes y en mayúsculas ("básica!" pasa a "BASICA").
    // Si se indica un largo, corta el texto a esa cantidad de letras.
    private static function abreviar(string $texto, ?int $largo = null): string
    {
        $limpio = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', Str::ascii($texto)));

        return $largo ? substr($limpio, 0, $largo) : $limpio;
    }
}