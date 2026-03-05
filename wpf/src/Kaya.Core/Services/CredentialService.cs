using AdysTech.CredentialManager;
using System.Net;

namespace Kaya.Core.Services;

public class CredentialService
{
    private const string TargetName = "Kaya Server Password";

    public string? GetPassword()
    {
        try
        {
            var credential = CredentialManager.GetCredentials(TargetName);
            return credential?.Password;
        }
        catch
        {
            return null;
        }
    }

    public bool SetPassword(string password)
    {
        try
        {
            var credential = new NetworkCredential(TargetName, password);
            CredentialManager.SaveCredentials(TargetName, credential);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public bool ClearPassword()
    {
        try
        {
            CredentialManager.RemoveCredentials(TargetName);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
