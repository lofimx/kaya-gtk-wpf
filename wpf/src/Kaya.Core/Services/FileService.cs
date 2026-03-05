using Kaya.Core.Models;

namespace Kaya.Core.Services;

public class FileService
{
    private static readonly string KayaDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".kaya");

    private static readonly string AngaDir = Path.Combine(KayaDir, "anga");
    private static readonly string MetaDir = Path.Combine(KayaDir, "meta");

    public void EnsureKayaDirectories()
    {
        Directory.CreateDirectory(KayaDir);
        Directory.CreateDirectory(AngaDir);
        Directory.CreateDirectory(MetaDir);
    }

    public void Save(AngaFile angaFile)
    {
        var filePath = GetSafeFilepath(AngaDir, angaFile.Filename, angaFile.FilenameWithNanos);
        File.WriteAllText(filePath, angaFile.Contents);
    }

    public void SaveDroppedFile(DroppedFileRecord droppedFile)
    {
        var filePath = GetSafeFilepath(AngaDir, droppedFile.Filename, droppedFile.FilenameWithNanos);
        File.WriteAllBytes(filePath, droppedFile.Contents);
    }

    public void SaveMeta(MetaFile metaFile)
    {
        var filePath = GetSafeFilepath(MetaDir, metaFile.Filename, metaFile.FilenameWithNanos);
        File.WriteAllText(filePath, metaFile.Contents);
    }

    private static string GetSafeFilepath(string directory, string filename, string filenameWithNanos)
    {
        var path = Path.Combine(directory, filename);
        if (File.Exists(path))
            return Path.Combine(directory, filenameWithNanos);
        return path;
    }
}
